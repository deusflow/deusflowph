import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer;
let clock = new THREE.Clock();

let mouseX = 0, mouseY = 0;
let scrollProgress = 0.0;
let targetScrollProgress = 0.0;
let scrollVelocity = 0.0;
let lastScrollY = 0;

let cameraCurve;
let cameraGroup;

let cloudsContainer;
let portalMesh;
let floatingBooks = [];
let textPlanes = [];

// DOM Elements
const hudSceneTitle = document.getElementById('hud-scene-title');
const hudTimecode = document.getElementById('hud-timecode');
const hudActLabel = document.getElementById('hud-act-label');
const stepDots = document.querySelectorAll('.step-dot');

const sectionMeta = [
  { title: 'PROLOGUE // THE THRESHOLD', timecode: 'FOLIO 01 / 05', act: 'ACT I // ROOTS' },
  { title: '01 // CHILDHOOD & CRAFT', timecode: 'FOLIO 02 / 05', act: 'ACT I // ROOTS' },
  { title: '02 // THE FIRST 35MM LENS', timecode: 'FOLIO 03 / 05', act: 'ACT I // ROOTS' },
  { title: '03 // THE DIGITAL DAWN', timecode: 'FOLIO 04 / 05', act: 'ACT I // ROOTS' },
  { title: 'EPILOGUE // THE PORTAL', timecode: 'FOLIO 05 / 05', act: 'ACT I // ROOTS' }
];

document.addEventListener('DOMContentLoaded', () => {
  initThree();
  buildSplinePath();
  loadAssets();
  build3DStoryTypography();
  initScrollTrigger();
  initMouseListener();
  animate();
});

function initThree() {
  const canvas = document.getElementById('webgl-canvas');
  scene = new THREE.Scene();
  
  // Gentle warm atmospheric fog (never blacks out close geometry)
  scene.fog = new THREE.FogExp2(0x0d0a08, 0.004);

  cameraGroup = new THREE.Group();
  scene.add(cameraGroup);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  cameraGroup.add(camera);

  // Performance-optimized WebGL Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Cap pixel ratio at 1.5 to prevent 4K GPU overdraw lag
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  window.addEventListener('resize', onWindowResize);

  // Warm library & ethereal directional lighting
  const ambientLight = new THREE.AmbientLight(0xffeedd, 2.0);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffe2b8, 2.8);
  mainLight.position.set(20, 35, 20);
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0xa0b8d8, 1.5);
  fillLight.position.set(-20, 15, -40);
  scene.add(fillLight);

  const warmHeroLight = new THREE.PointLight(0xffa347, 4.5, 100);
  warmHeroLight.position.set(0, 2, -10);
  scene.add(warmHeroLight);
}

// ── CAMERA SPLINE PATH (Starts directly in view of clouds) ────
function buildSplinePath() {
  cameraCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.5, 5),      // Beat 0: Initial view (immediate clouds & title)
    new THREE.Vector3(1.2, 0.2, -18),  // Beat 1: First cloud gate
    new THREE.Vector3(-1.8, -0.4, -42),// Beat 2: Cloud valley & grimoires
    new THREE.Vector3(2.0, 0.3, -68),  // Beat 3: Memory archives
    new THREE.Vector3(-0.8, 0.5, -92), // Beat 4: Approaching the Portal
    new THREE.Vector3(0, 0, -108)      // Beat 5: Inside the Portal
  ]);
  cameraCurve.tension = 0.5;

  // Position camera at start point immediately
  const startPos = cameraCurve.getPointAt(0.001);
  const lookPos = cameraCurve.getPointAt(0.04);
  cameraGroup.position.copy(startPos);
  cameraGroup.lookAt(lookPos);
}

// ── LOAD 3D ASSETS (Optimized 1K Cloud Model) ────────────────
function loadAssets() {
  const loader = new GLTFLoader();

  // 1. Clouds Model (Using fast 1K version)
  loader.load(
    '/assets/models/%D0%9E%D0%91%D0%9B%D0%90%D0%9A%D0%90%201%D0%9A.glb',
    (gltf) => {
      const model = gltf.scene;
      
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Center model origin
      model.position.sub(center);

      cloudsContainer = new THREE.Group();
      cloudsContainer.add(model);

      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 140 / (maxDim || 1);
      cloudsContainer.scale.setScalar(scale);
      
      // Positioned right along the spline corridor
      cloudsContainer.position.set(0, -3, -50);

      // Fast single-sided rendering for high FPS
      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.frustumCulled = true;
          if (child.name && child.name.includes('Sky')) {
            child.material.side = THREE.BackSide;
            child.material.depthWrite = false;
            child.material.transparent = true;
            child.material.opacity = 0.7;
          } else {
            child.material.side = THREE.FrontSide;
            child.material.transparent = true;
            child.material.opacity = 0.95;
            child.material.roughness = 0.6;
          }
        }
      });

      scene.add(cloudsContainer);
    },
    undefined,
    (err) => { console.warn('1K Clouds model note:', err); }
  );

  // 2. Glowing Portal at Z = -106
  loader.load(
    '/assets/models/%D0%BF%D0%BE%D1%80%D1%82%D0%B0%D0%BB2.glb',
    (gltf) => {
      portalMesh = gltf.scene;
      
      const box = new THREE.Box3().setFromObject(portalMesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);
      portalMesh.position.sub(center);

      const portalContainer = new THREE.Group();
      portalContainer.add(portalMesh);
      
      const maxDim = Math.max(size.x, size.y, size.z);
      portalContainer.scale.setScalar(9.0 / (maxDim || 1));
      portalContainer.position.set(0, 0, -106);

      portalMesh.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.side = THREE.DoubleSide;
        }
      });

      scene.add(portalContainer);
    },
    undefined,
    (err) => { console.warn('Portal model note:', err); }
  );

  // 3. Calm Floating Grimoire Books
  loader.load(
    '/assets/models/%D0%BA%D0%BD%D0%B8%D0%B3%D0%B0.glb',
    (gltf) => {
      const positions = [
        new THREE.Vector3(3.2, 1.2, -8),
        new THREE.Vector3(-3.8, -0.8, -28),
        new THREE.Vector3(3.5, 0.6, -52),
        new THREE.Vector3(-3.2, 1.2, -78),
        new THREE.Vector3(2.8, -0.5, -96)
      ];

      positions.forEach((pos, idx) => {
        const book = gltf.scene.clone();
        book.position.copy(pos);
        book.rotation.set(0.2 + idx * 0.3, 0.4 + idx * 0.5, 0.1);
        book.scale.setScalar(1.5);
        book.userData = {
          baseY: pos.y,
          rotSpeedX: 0.002 * (idx % 2 === 0 ? 1 : -1),
          rotSpeedY: 0.003 * (idx % 2 === 0 ? -1 : 1),
          floatSpeed: 0.7 + idx * 0.15,
          offset: idx * 2.0
        };
        scene.add(book);
        floatingBooks.push(book);
      });
    },
    undefined,
    (err) => { console.warn('Book model note:', err); }
  );
}

// ── 3D FLOATING STORY TYPOGRAPHY ─────────────────────────────
function create3DTextCard(badge, title, subtitle, pos, rotY) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 1024, 512);

  // Soft manuscript glow background
  const grad = ctx.createRadialGradient(512, 256, 10, 512, 256, 440);
  grad.addColorStop(0, 'rgba(28, 19, 12, 0.72)');
  grad.addColorStop(0.75, 'rgba(13, 10, 8, 0.38)');
  grad.addColorStop(1, 'rgba(13, 10, 8, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // 1. Badge (Small caps golden serif)
  if (badge) {
    ctx.font = '600 24px "Space Mono", monospace';
    ctx.fillStyle = 'rgba(216, 184, 136, 0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(badge.toUpperCase(), 512, 105);
  }

  // 2. Title (Prominent Editorial Serif)
  ctx.font = '700 48px "Cinzel", "Playfair Display", Georgia, serif';
  ctx.fillStyle = '#fce2b8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(216, 184, 136, 0.65)';
  ctx.shadowBlur = 18;
  ctx.fillText(title, 512, 160);

  // 3. Subtitle / Story Line
  if (subtitle) {
    ctx.shadowBlur = 0;
    ctx.font = '400 26px "Playfair Display", Georgia, serif';
    ctx.fillStyle = '#d8cdb4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    const words = subtitle.split(' ');
    let line = '';
    let y = 245;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 860 && n > 0) {
        ctx.fillText(line, 512, y);
        line = words[n] + ' ';
        y += 38;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 512, y);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 4.25), mat);
  plane.position.copy(pos);
  plane.rotation.y = rotY;
  plane.userData.baseY = pos.y;
  scene.add(plane);
  textPlanes.push(plane);
  return plane;
}

function build3DStoryTypography() {
  // Act 0: Initial Screen (Z = -6, immediately visible on load!)
  create3DTextCard(
    'DEUSFLOW ARCHIVES · FOLIO 00',
    'ОЛЕГ РО',
    'Ніч у чарівній бібліотеці: історія про те, як дитяча допитливість перетворюється на ремесло.',
    new THREE.Vector3(0, 0.8, -6),
    0
  );

  // Act 1: Craft & Embroidery
  create3DTextCard(
    '01 // CRAFT & EMBROIDERY',
    'ДИТЯЧА ДОПИТЛИВІСТЬ',
    'Усе життя я любив малювати й перемальовувати картинки на свій лад. Праця, вишивка та перші кроки у світ форми.',
    new THREE.Vector3(3.8, 0.2, -26),
    -0.22
  );

  // Act 2: The First Lens
  create3DTextCard(
    '02 // THE FIRST LENS · 35MM',
    'ОЛІМПУС ТА КРИМ',
    'Бабуся подарувала мені плівкову камеру. Перші невпевнені кадри, море, Крим та зародження любові до світла.',
    new THREE.Vector3(-4.0, -0.3, -50),
    0.20
  );

  // Act 3: Digital Dawn
  create3DTextCard(
    '03 // DIGITAL DAWN · CANON EOS',
    'ПОШУК ВЛАСНОГО ПОЧЕРКУ',
    'Через пару років з’явився Canon 1000D. Сотні туторіалів, ночі за фотошопом та візуальна поезія.',
    new THREE.Vector3(3.6, 0.5, -76),
    -0.18
  );

  // Epilogue: The Portal
  create3DTextCard(
    'EPILOGUE // THE PORTAL',
    'ЗАКЛИНАННЯ МИТІ',
    'Кожен кадр — це заклинання, що затримує мить, яка більше ніколи не повториться.',
    new THREE.Vector3(0, 1.8, -98),
    0
  );
}

// ── GSAP SMOOTH SCROLL INTEGRATION ───────────────────────────
function initScrollTrigger() {
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.0,
    onUpdate: (self) => {
      targetScrollProgress = self.progress;
      const idx = Math.min(sectionMeta.length - 1, Math.floor(self.progress * sectionMeta.length));
      updateHUD(idx);
    }
  });

  window.addEventListener('scroll', () => {
    const currentY = window.scrollY;
    scrollVelocity = currentY - lastScrollY;
    lastScrollY = currentY;
  });
}

function updateHUD(index) {
  const meta = sectionMeta[index] || sectionMeta[0];
  if (hudSceneTitle) hudSceneTitle.innerText = meta.title;
  if (hudTimecode) hudTimecode.innerText = meta.timecode;
  if (hudActLabel) hudActLabel.innerText = meta.act;
  stepDots.forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
}

// ── RENDER & ANIMATION LOOP ──────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();

  scrollVelocity *= 0.9;
  scrollProgress += (targetScrollProgress - scrollProgress) * 0.06;

  // Move camera along spline smoothly
  if (cameraCurve) {
    const p = Math.max(0.001, Math.min(0.999, scrollProgress));
    const camPos = cameraCurve.getPointAt(p);
    cameraGroup.position.copy(camPos);

    const lookAheadP = Math.min(0.999, p + 0.035);
    const lookAtPos = cameraCurve.getPointAt(lookAheadP);
    cameraGroup.lookAt(lookAtPos);
  }

  // Mouse Parallax
  const targetX = (mouseX / window.innerWidth) * 2 - 1;
  const targetY = -(mouseY / window.innerHeight) * 2 + 1;
  camera.position.x += (targetX * 0.3 - camera.position.x) * 0.05;
  camera.position.y += (targetY * 0.25 - camera.position.y) * 0.05;

  // Gentle floating for books
  for (let i = 0; i < floatingBooks.length; i++) {
    const b = floatingBooks[i];
    b.rotation.x += b.userData.rotSpeedX;
    b.rotation.y += b.userData.rotSpeedY;
    b.position.y = b.userData.baseY + Math.sin(time * b.userData.floatSpeed + b.userData.offset) * 0.2;
  }

  // Gentle floating for text cards
  for (let i = 0; i < textPlanes.length; i++) {
    const p = textPlanes[i];
    p.position.y = p.userData.baseY + Math.sin(time * 0.8 + p.position.z * 0.1) * 0.1;
  }

  // Portal gentle rotation
  if (portalMesh) {
    portalMesh.rotation.y = time * 0.12;
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function initMouseListener() {
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
}
