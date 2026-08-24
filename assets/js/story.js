import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';

let scene, camera, renderer;
let clock = new THREE.Clock();

let mouseX = 0, mouseY = 0;
let scrollProgress = 0.0;
let targetScrollProgress = 0.0;
let scrollVelocity = 0.0;
let lastScrollY = 0;

let cameraCurve;

let cloudsContainer;
let portalMesh;
let floatingBooks = [];
let textPlanes = [];

// Physics / Capsule Collision System
let worldOctree;
let playerCapsule;
let collisionGroup;

// DOM Elements
const hudSceneTitle = document.getElementById('hud-scene-title');
const hudTimecode = document.getElementById('hud-timecode');
const hudActLabel = document.getElementById('hud-act-label');
const stepDots = document.querySelectorAll('.step-dot');

const sectionMeta = [
  { title: 'PROLOGUE // THE INNER SANCTUM', timecode: 'FOLIO 01 / 05', act: 'ACT I // ROOTS' },
  { title: '01 // CHILDHOOD & CRAFT', timecode: 'FOLIO 02 / 05', act: 'ACT I // ROOTS' },
  { title: '02 // THE FIRST 35MM LENS', timecode: 'FOLIO 03 / 05', act: 'ACT I // ROOTS' },
  { title: '03 // THE DIGITAL DAWN', timecode: 'FOLIO 04 / 05', act: 'ACT I // ROOTS' },
  { title: 'EPILOGUE // THE PORTAL', timecode: 'FOLIO 05 / 05', act: 'ACT I // ROOTS' }
];

document.addEventListener('DOMContentLoaded', () => {
  initThree();
  initCollisionSystem();
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
  
  // Soft atmospheric fog
  scene.fog = new THREE.FogExp2(0x0d0a08, 0.0035);

  // Near plane at 0.05 prevents camera from slicing close geometry
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 1000);
  scene.add(camera);

  // Performance-optimized WebGL Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  window.addEventListener('resize', onWindowResize);

  // Warm library & celestial directional lighting
  const ambientLight = new THREE.AmbientLight(0xffeedd, 2.2);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffe2b8, 3.0);
  mainLight.position.set(25, 40, 20);
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0xa0b8d8, 1.6);
  fillLight.position.set(-25, 20, -50);
  scene.add(fillLight);

  const warmGateLight = new THREE.PointLight(0xffa347, 5.0, 100);
  warmGateLight.position.set(0, 0, -25);
  scene.add(warmGateLight);
}

// ── COLLISION & CAPSULE SYSTEM ────────────────────────────────
function initCollisionSystem() {
  worldOctree = new Octree();
  
  // Player Capsule: radius 0.35, height 1.2
  playerCapsule = new Capsule(
    new THREE.Vector3(0, -0.4, 0),
    new THREE.Vector3(0, 0.4, 0),
    0.35
  );

  // Invisible low-poly corridor bounds (floor, ceiling, walls)
  collisionGroup = new THREE.Group();
  collisionGroup.visible = false;

  // Floor barrier
  const floorGeo = new THREE.PlaneGeometry(30, 120);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMesh = new THREE.Mesh(floorGeo, new THREE.MeshBasicMaterial());
  floorMesh.position.set(0, -5.5, -55);
  collisionGroup.add(floorMesh);

  // Ceiling barrier
  const ceilGeo = new THREE.PlaneGeometry(30, 120);
  ceilGeo.rotateX(Math.PI / 2);
  const ceilMesh = new THREE.Mesh(ceilGeo, new THREE.MeshBasicMaterial());
  ceilMesh.position.set(0, 5.5, -55);
  collisionGroup.add(ceilMesh);

  // Left & Right boundary walls
  const wallLeftGeo = new THREE.PlaneGeometry(120, 20);
  wallLeftGeo.rotateY(Math.PI / 2);
  const wallLeft = new THREE.Mesh(wallLeftGeo, new THREE.MeshBasicMaterial());
  wallLeft.position.set(-8.0, 0, -55);
  collisionGroup.add(wallLeft);

  const wallRight = new THREE.Mesh(wallLeftGeo.clone(), new THREE.MeshBasicMaterial());
  wallRight.position.set(8.0, 0, -55);
  collisionGroup.add(wallRight);

  scene.add(collisionGroup);
  worldOctree.fromGraphNode(collisionGroup);
}

// ── CAMERA SPLINE PATH (Deep inside the cloud canyon) ─────────
function buildSplinePath() {
  // Center airway of the cloud canyon (eye level inside the clouds)
  cameraCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.5, -12),     // Beat 0: Inside the first chamber
    new THREE.Vector3(1.0, -0.2, -32),   // Beat 1: Weaving through the cloud archway
    new THREE.Vector3(-1.4, -0.6, -54),  // Beat 2: Gliding alongside the flying ship
    new THREE.Vector3(1.6, -0.3, -76),   // Beat 3: Starry cloud canyon
    new THREE.Vector3(-0.5, 0.0, -96),   // Beat 4: Approaching the glowing Portal
    new THREE.Vector3(0, 0, -112)        // Beat 5: Stepping into the Portal
  ]);
  cameraCurve.tension = 0.5;

  // Set initial position
  const startPos = cameraCurve.getPointAt(0.001);
  const lookPos = cameraCurve.getPointAt(0.04);
  camera.position.copy(startPos);
  camera.lookAt(lookPos);
}

// ── LOAD 3D ASSETS WITH ACCURATE CLOUDS CENTERING ────────────
function loadAssets() {
  const loader = new GLTFLoader();

  // 1. 1K Clouds Model
  loader.load(
    '/assets/models/%D0%9E%D0%91%D0%9B%D0%90%D0%9A%D0%90%201%D0%9A.glb',
    (gltf) => {
      const model = gltf.scene;
      
      // Calculate bounding box strictly on clouds and ship (exclude Sky sphere)
      const box = new THREE.Box3();
      model.traverse((child) => {
        if (child.isMesh && (!child.name || !child.name.includes('Sky'))) {
          child.geometry.computeBoundingBox();
          box.expandByObject(child);
        }
      });

      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Center clouds geometry at exact middle of canyon
      model.position.sub(center);

      cloudsContainer = new THREE.Group();
      cloudsContainer.add(model);

      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 145 / (maxDim || 1);
      cloudsContainer.scale.setScalar(scale);
      
      // Rotated so we enter into the cloud tunnel
      cloudsContainer.rotation.y = Math.PI;
      cloudsContainer.position.set(0, 0, -45);

      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.frustumCulled = true;
          if (child.name && child.name.includes('Sky')) {
            child.material.side = THREE.BackSide;
            child.material.depthWrite = false;
            child.material.transparent = true;
            child.material.opacity = 0.75;
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

  // 2. Destination Portal at Z = -110
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
      portalContainer.position.set(0, 0, -110);

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
        new THREE.Vector3(2.8, 0.5, -18),
        new THREE.Vector3(-3.2, -0.8, -38),
        new THREE.Vector3(3.0, 0.4, -60),
        new THREE.Vector3(-2.8, 0.8, -82),
        new THREE.Vector3(2.2, -0.4, -100)
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

// ── 3D STORY TYPOGRAPHY ──────────────────────────────────────
function create3DTextCard(badge, title, subtitle, pos, rotY = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 1024, 512);

  // Soft seamless manuscript glow vignette
  const grad = ctx.createRadialGradient(512, 256, 10, 512, 256, 380);
  grad.addColorStop(0, 'rgba(13, 10, 8, 0.65)');
  grad.addColorStop(0.6, 'rgba(13, 10, 8, 0.25)');
  grad.addColorStop(1, 'rgba(13, 10, 8, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // 1. Badge
  if (badge) {
    ctx.font = '600 24px "Space Mono", monospace';
    ctx.fillStyle = 'rgba(216, 184, 136, 0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(badge.toUpperCase(), 512, 105);
  }

  // 2. Title
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
  // Act 0: Initial Screen (Inside the clouds, Z = -20)
  create3DTextCard(
    'DEUSFLOW ARCHIVES · FOLIO 00',
    'ОЛЕГ РО',
    'Ніч у чарівній бібліотеці: історія про те, як дитяча допитливість перетворюється на ремесло.',
    new THREE.Vector3(0, 0.0, -20),
    0
  );

  // Act 1: Craft & Embroidery
  create3DTextCard(
    '01 // CRAFT & EMBROIDERY',
    'ДИТЯЧА ДОПИТЛИВІСТЬ',
    'Усе життя я любив малювати й перемальовувати картинки на свій лад. Праця, вишивка та перші кроки у світ форми.',
    new THREE.Vector3(3.4, -0.2, -40),
    -0.18
  );

  // Act 2: The First Lens
  create3DTextCard(
    '02 // THE FIRST LENS · 35MM',
    'ОЛІМПУС ТА КРИМ',
    'Бабуся подарувала мені плівкову камеру. Перші невпевнені кадри, море, Крим та зародження любові до світла.',
    new THREE.Vector3(-3.5, -0.4, -62),
    0.18
  );

  // Act 3: Digital Dawn
  create3DTextCard(
    '03 // DIGITAL DAWN · CANON EOS',
    'ПОШУК ВЛАСНОГО ПОЧЕРКУ',
    'Через пару років з’явився Canon 1000D. Сотні туторіалів, ночі за фотошопом та візуальна поезія.',
    new THREE.Vector3(3.2, 0.2, -84),
    -0.15
  );

  // Epilogue: The Portal
  create3DTextCard(
    'EPILOGUE // THE PORTAL',
    'ЗАКЛИНАННЯ МИТІ',
    'Кожен кадр — це заклинання, що затримує мить, яка більше ніколи не повториться.',
    new THREE.Vector3(0, 1.2, -102),
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

// ── RENDER & ANIMATION LOOP WITH CAPSULE COLLISION ───────────
function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();

  scrollVelocity *= 0.9;
  scrollProgress += (targetScrollProgress - scrollProgress) * 0.06;

  // Move camera along spline with Capsule & Octree collision sliding
  if (cameraCurve) {
    const p = Math.max(0.001, Math.min(0.999, scrollProgress));
    const camPos = cameraCurve.getPointAt(p);
    
    // Mouse Parallax offset
    const targetX = (mouseX / window.innerWidth) * 2 - 1;
    const targetY = -(mouseY / window.innerHeight) * 2 + 1;
    
    const desiredPos = new THREE.Vector3(
      camPos.x + targetX * 0.35,
      camPos.y + targetY * 0.25,
      camPos.z
    );

    // Update capsule position
    playerCapsule.start.set(desiredPos.x, desiredPos.y - 0.4, desiredPos.z);
    playerCapsule.end.set(desiredPos.x, desiredPos.y + 0.4, desiredPos.z);

    // Check collision against low-poly bounds
    if (worldOctree) {
      const hit = worldOctree.capsuleIntersect(playerCapsule);
      if (hit) {
        playerCapsule.translate(hit.normal.multiplyScalar(hit.depth));
      }
    }

    // Set camera to capsule center
    camera.position.set(
      (playerCapsule.start.x + playerCapsule.end.x) * 0.5,
      (playerCapsule.start.y + playerCapsule.end.y) * 0.5,
      playerCapsule.start.z
    );

    const lookAheadP = Math.min(0.999, p + 0.04);
    const lookAtPos = cameraCurve.getPointAt(lookAheadP);
    camera.lookAt(lookAtPos);
  }

  // Floating books gentle hover
  for (let i = 0; i < floatingBooks.length; i++) {
    const b = floatingBooks[i];
    b.rotation.x += b.userData.rotSpeedX;
    b.rotation.y += b.userData.rotSpeedY;
    b.position.y = b.userData.baseY + Math.sin(time * b.userData.floatSpeed + b.userData.offset) * 0.2;
  }

  // Floating text planes gentle wave
  for (let i = 0; i < textPlanes.length; i++) {
    const p = textPlanes[i];
    p.position.y = p.userData.baseY + Math.sin(time * 0.8 + p.position.z * 0.1) * 0.08;
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
