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
  // Wait for Google Fonts to be ready so canvas renders with handwritten fonts
  document.fonts.ready.then(() => {
    initThree();
    initCollisionSystem();
    buildSplinePath();
    loadAssets();
    build3DStoryTypography();
    initScrollTrigger();
    initMouseListener();
    animate();
  });
});

function initThree() {
  const canvas = document.getElementById('webgl-canvas');
  scene = new THREE.Scene();
  
  // Soft atmospheric fog
  scene.fog = new THREE.FogExp2(0x0d0a08, 0.0035);

  // Near 0.05, Far 220 (optimal 4400:1 ratio)
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 220);
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
  renderer.toneMappingExposure = 1.35;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  window.addEventListener('resize', onWindowResize);

  // Warm atmospheric directional and ambient lighting
  const ambientLight = new THREE.AmbientLight(0xffeedd, 1.5);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffe2b8, 2.2);
  mainLight.position.set(25, 40, 20);
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0x8fa8c8, 1.4);
  fillLight.position.set(-25, 20, -50);
  scene.add(fillLight);

  const warmGateLight = new THREE.PointLight(0xffa347, 2.5, 80);
  warmGateLight.position.set(0, 0, -25);
  scene.add(warmGateLight);
}

// ── COLLISION & CAPSULE SYSTEM ────────────────────────────────
function initCollisionSystem() {
  worldOctree = new Octree();
  
  playerCapsule = new Capsule(
    new THREE.Vector3(0, -0.4, 0),
    new THREE.Vector3(0, 0.4, 0),
    0.35
  );

  // Invisible low-poly corridor bounds
  collisionGroup = new THREE.Group();
  collisionGroup.visible = false;

  const floorGeo = new THREE.PlaneGeometry(30, 120);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMesh = new THREE.Mesh(floorGeo, new THREE.MeshBasicMaterial());
  floorMesh.position.set(0, -5.5, -55);
  collisionGroup.add(floorMesh);

  const ceilGeo = new THREE.PlaneGeometry(30, 120);
  ceilGeo.rotateX(Math.PI / 2);
  const ceilMesh = new THREE.Mesh(ceilGeo, new THREE.MeshBasicMaterial());
  ceilMesh.position.set(0, 5.5, -55);
  collisionGroup.add(ceilMesh);

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

// ── CAMERA SPLINE PATH (Cinematic flyby around ship) ──────────
function buildSplinePath() {
  // Graceful flight path that swoops past the ship on the starboard side
  cameraCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.2, -12),     // Beat 0: Inside the first cloud chamber
    new THREE.Vector3(2.4, 0.5, -30),   // Beat 1: Approaching the ship canyon
    new THREE.Vector3(3.8, 0.8, -48),   // Beat 2: Gliding alongside the ship (avoids mast collision!)
    new THREE.Vector3(0.6, 0.3, -68),   // Beat 3: Swooping past the bow into the cloud depths
    new THREE.Vector3(-1.2, 0.2, -88),  // Beat 4: Approaching the mystical Portal
    new THREE.Vector3(0, 0, -112)       // Beat 5: Stepping into the Portal
  ]);
  cameraCurve.tension = 0.5;

  const startPos = cameraCurve.getPointAt(0.001);
  const lookPos = cameraCurve.getPointAt(0.04);
  camera.position.copy(startPos);
  camera.lookAt(lookPos);
}

// ── LOAD 3D ASSETS WITH MATERIAL REFINEMENT ───────────────────
function loadAssets() {
  const loader = new GLTFLoader();

  // 1. 1K Clouds Model
  loader.load(
    '/assets/models/%D0%9E%D0%91%D0%9B%D0%90%D0%9A%D0%90%201%D0%9A.glb',
    (gltf) => {
      const model = gltf.scene;
      
      // Calculate bounding box strictly on clouds and ship
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

      model.position.sub(center);

      cloudsContainer = new THREE.Group();
      cloudsContainer.add(model);

      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 145 / (maxDim || 1);
      cloudsContainer.scale.setScalar(scale);
      
      cloudsContainer.rotation.y = Math.PI;
      cloudsContainer.position.set(0, 0, -45);

      // Deep Material Optimization: Eliminates self-illuminating white lines
      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.frustumCulled = true;
          
          if (child.name && child.name.includes('Sky')) {
            // Sky Dome: soft background hemisphere
            child.material.side = THREE.BackSide;
            child.material.depthWrite = false;
            child.material.transparent = true;
            child.material.opacity = 0.75;
          } else if (child.name && child.name.includes('Boot')) {
            // Flying Ship: preserve wood and sail textures with rich standard shading
            const tex = child.material.emissiveMap || child.material.map;
            child.material = new THREE.MeshStandardMaterial({
              map: tex,
              roughness: 0.7,
              metalness: 0.05,
              side: THREE.FrontSide
            });
          } else {
            // Cloud Meshes (Cloud_Poly, Cloud_1, Cloud_2, Cloud_3):
            // Replace blinding self-emitting white contour lines with soft physical cloud shading
            const tex = child.material.emissiveMap || child.material.map;
            child.material = new THREE.MeshStandardMaterial({
              map: tex,
              color: new THREE.Color(0xdce7f5), // Soft atmospheric cloud tone
              roughness: 0.85,
              metalness: 0.0,
              emissive: new THREE.Color(0x141f30), // Deep blue-black ambient tone (NOT white)
              emissiveIntensity: 0.35,
              side: THREE.DoubleSide,
              transparent: false,
              depthWrite: true
            });
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
        new THREE.Vector3(2.6, 0.8, -18),
        new THREE.Vector3(-3.0, -0.4, -38),
        new THREE.Vector3(2.8, 0.6, -60),
        new THREE.Vector3(-2.6, 0.9, -82),
        new THREE.Vector3(1.8, -0.2, -100)
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

// ── 3D HANDWRITTEN STORY TYPOGRAPHY (Pure Transparent, No Boxes) ─
function createHandwritten3DText(badge, title, subtitle, pos, rotY = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // 100% Transparent background (NO fillRect, NO boxes, NO borders)
  ctx.clearRect(0, 0, 1024, 512);

  // 1. Badge / Small Caps Header
  if (badge) {
    ctx.font = '600 22px "Space Mono", monospace';
    ctx.fillStyle = '#d8b888';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 10;
    ctx.fillText(badge.toUpperCase(), 512, 90);
  }

  // 2. Main Title (Handwritten Script)
  ctx.font = '700 58px "Caveat", "Marck Script", cursive';
  ctx.fillStyle = '#fff4dc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(216, 184, 136, 0.9)';
  ctx.shadowBlur = 24;
  ctx.fillText(title, 512, 140);

  // 3. Subtitle / Story Line (Poetic Handwritten Script)
  if (subtitle) {
    ctx.font = '500 32px "Caveat", "Marck Script", cursive';
    ctx.fillStyle = '#e8dcc0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 12;
    
    const words = subtitle.split(' ');
    let line = '';
    let y = 230;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 860 && n > 0) {
        ctx.fillText(line, 512, y);
        line = words[n] + ' ';
        y += 44;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 512, y);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  // Pure transparent material without any background plane
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    alphaTest: 0.02
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
  createHandwritten3DText(
    'DEUSFLOW ARCHIVES · FOLIO 00',
    'Олег Ро',
    'Ніч у чарівній бібліотеці: історія про те, як дитяча допитливість перетворюється на ремесло.',
    new THREE.Vector3(0, 0.0, -20),
    0
  );

  // Act 1: Craft & Embroidery
  createHandwritten3DText(
    '01 // CRAFT & EMBROIDERY',
    'Дитяча Допитливість',
    'Усе життя я любив малювати й перемальовувати картинки на свій лад. Праця, вишивка та перші кроки у світ форми.',
    new THREE.Vector3(3.2, 0.2, -38),
    -0.18
  );

  // Act 2: The First Lens (Starboard side near ship)
  createHandwritten3DText(
    '02 // THE FIRST LENS · 35MM',
    'Олімпус та Крим',
    'Бабуся подарувала мені плівкову камеру. Перші невпевнені кадри, море, Крим та зародження любові до світла.',
    new THREE.Vector3(4.0, 0.5, -56),
    -0.15
  );

  // Act 3: Digital Dawn
  createHandwritten3DText(
    '03 // DIGITAL DAWN · CANON EOS',
    'Пошук Власного Почерку',
    'Через пару років з’явився Canon 1000D. Сотні туторіалів, ночі за фотошопом та візуальна поезія.',
    new THREE.Vector3(2.8, 0.2, -78),
    -0.12
  );

  // Epilogue: The Portal
  createHandwritten3DText(
    'EPILOGUE // THE PORTAL',
    'Заклинання Миті',
    'Кожен кадр — це заклинання, що затримує мить, яка більше ніколи не повториться.',
    new THREE.Vector3(0, 1.2, -100),
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
