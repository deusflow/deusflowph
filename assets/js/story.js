import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';

let scene, camera, renderer;
let clock = new THREE.Clock();

let mouseX = 0, mouseY = 0;
let scrollProgress = 0.0;
let targetScrollProgress = 0.0;
let scrollVelocity = 0.0;
let lastScrollY = 0;

let prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let cameraPathCurve;
let lookAtPathCurve;

let cloudsContainer;
let shipMesh;
let portalMesh;
let floatingBooks = [];
let textPlanes = [];

let loadingManager;

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
  initLoadingManager();

  // Ensure casual Cyrillic handwriting font is loaded before drawing
  Promise.all([
    document.fonts.load('700 52px "Caveat"'),
    document.fonts.load('500 32px "Caveat"'),
    document.fonts.ready
  ]).then(() => {
    initThree();
    initCollisionSystem();
    buildSlalomPath();
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

  camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.05, 250);
  scene.add(camera);

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
  scene.add(ambientLight);

  window.addEventListener('resize', onWindowResize);
}

// ── COLLISION & CAPSULE SYSTEM ────────────────────────────────
function initCollisionSystem() {
  worldOctree = new Octree();
  
  playerCapsule = new Capsule(
    new THREE.Vector3(0, -0.4, 0),
    new THREE.Vector3(0, 0.4, 0),
    0.35
  );

  collisionGroup = new THREE.Group();
  collisionGroup.visible = false;

  const floorGeo = new THREE.PlaneGeometry(60, 140);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMesh = new THREE.Mesh(floorGeo, new THREE.MeshBasicMaterial());
  floorMesh.position.set(0, -14, -40);
  collisionGroup.add(floorMesh);

  const ceilGeo = new THREE.PlaneGeometry(60, 140);
  ceilGeo.rotateX(Math.PI / 2);
  const ceilMesh = new THREE.Mesh(ceilGeo, new THREE.MeshBasicMaterial());
  ceilMesh.position.set(0, 14, -40);
  collisionGroup.add(ceilMesh);

  const wallLeftGeo = new THREE.PlaneGeometry(140, 30);
  wallLeftGeo.rotateY(Math.PI / 2);
  const wallLeft = new THREE.Mesh(wallLeftGeo, new THREE.MeshBasicMaterial());
  wallLeft.position.set(-25.0, 0, -40);
  collisionGroup.add(wallLeft);

  const wallRight = new THREE.Mesh(wallLeftGeo.clone(), new THREE.MeshBasicMaterial());
  wallRight.position.set(25.0, 0, -40);
  collisionGroup.add(wallRight);

  scene.add(collisionGroup);
  worldOctree.fromGraphNode(collisionGroup);
}

// ── SLALOM CAMERA PATH & DYNAMIC LOOK-AT CHOREOGRAPHY ─────────
function buildSlalomPath() {
  // 1. Camera Eye Position: 7.5 - 8.0 units away from text cards for comfortable viewing
  cameraPathCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 2.2, 6.0),     // Beat 0: Clean blue open sky, looking comfortably at Prologue
    new THREE.Vector3(-0.6, 1.8, -10.5),  // Beat 1: Glides left around ship, frames Text 1 from 7.5m
    new THREE.Vector3(0.6, 1.7, -30.5),   // Beat 2: Sweeps diagonally right, frames Text 2 from 7.5m
    new THREE.Vector3(-0.5, 1.6, -50.5),  // Beat 3: Sweeps diagonally left, frames Text 3 from 7.5m
    new THREE.Vector3(0.0, 1.4, -68.0),   // Beat 4: Enters center approaching Portal
    new THREE.Vector3(0.0, 1.2, -81.0)    // Beat 5: Gliding into the Portal
  ]);
  cameraPathCurve.tension = 0.45;

  // 2. Camera Look-At Target: Points directly at the center of each slanted text card
  lookAtPathCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 2.2, -2.0),    // Beat 0 LookAt: Center prologue
    new THREE.Vector3(-3.2, 1.8, -18.0),  // Beat 1 LookAt: Left slanted Text 1
    new THREE.Vector3(3.2, 1.7, -38.0),   // Beat 2 LookAt: Right slanted Text 2
    new THREE.Vector3(-3.0, 1.6, -58.0),  // Beat 3 LookAt: Left slanted Text 3
    new THREE.Vector3(0.0, 1.4, -76.0),   // Beat 4 LookAt: Portal epilogue
    new THREE.Vector3(0.0, 1.2, -85.0)    // Beat 5 LookAt: Core of Portal
  ]);
  lookAtPathCurve.tension = 0.45;

  const startPos = cameraPathCurve.getPointAt(0.001);
  const lookPos = lookAtPathCurve.getPointAt(0.001);
  camera.position.copy(startPos);
  camera.lookAt(lookPos);
}

// ── LOAD 3D ASSETS (Cleaned Model without Foreground Shards) ──
function initLoadingManager() {
  const loadingBar = document.getElementById('loading-bar');
  const loadingText = document.getElementById('loading-text');
  const loadingOverlay = document.getElementById('loading-overlay');

  loadingManager = new THREE.LoadingManager();
  
  loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
    const progress = (itemsLoaded / itemsTotal) * 100;
    if (loadingBar) loadingBar.style.width = `${progress}%`;
    if (loadingText) loadingText.innerText = `Завантаження... ${Math.round(progress)}%`;
  };

  loadingManager.onLoad = () => {
    if (loadingOverlay) {
      setTimeout(() => {
        loadingOverlay.classList.add('fade-out');
        setTimeout(() => {
          loadingOverlay.style.display = 'none';
        }, 800);
      }, 500);
    }
  };

  loadingManager.onError = (url) => {
    console.error('There was an error loading ' + url);
  };
}

function loadAssets() {
  const loader = new GLTFLoader(loadingManager);
  
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  loader.setDRACOLoader(dracoLoader);

  // 1. Original 4K Clouds Model & Flying Ship
  loader.load(
    '/assets/models/%D0%BE%D0%B1%D0%BB%D0%B0%D0%BA%D0%B0%20%D1%81%20%D1%87%D0%B5%D0%B3%D0%BE%20%D0%BD%D0%B0%D1%87%D0%B8%D0%BD%D0%B0%D0%B5%D0%BC.glb',
    (gltf) => {
      const model = gltf.scene;
      
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      model.position.sub(center);

      cloudsContainer = new THREE.Group();
      cloudsContainer.add(model);

      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 140 / (maxDim || 1);
      cloudsContainer.scale.setScalar(scale);
      
      cloudsContainer.rotation.y = 0;
      cloudsContainer.position.set(0, 0, -35);

      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.frustumCulled = false;
          
          if (child.name && child.name.includes('Sky')) {
            // Pristine solid background sky hemisphere
            child.material.side = THREE.BackSide;
            child.material.depthWrite = false;
            child.material.transparent = false;
            child.renderOrder = 0;
          } else if (child.name && child.name.includes('Boot')) {
            // Flying Ship
            shipMesh = child;
            child.material.side = THREE.DoubleSide;
            child.material.depthWrite = true;
            child.material.transparent = false;
            if ('roughness' in child.material) child.material.roughness = 0.7;
            if ('metalness' in child.material) child.material.metalness = 0.0;
            child.renderOrder = 1;
          } else if (child.name && (child.name.includes('Cloud_3') || child.name.includes('Cloud_2'))) {
            // HIDE the foreground jagged shards that cut across the start screen
            child.visible = false;
          } else if (child.name && child.name.includes('Poly')) {
            // Deep canyon floor & mountains
            child.material.side = THREE.DoubleSide;
            child.material.depthWrite = true;
            child.material.transparent = false;
            if ('roughness' in child.material) child.material.roughness = 1.0;
            if ('metalness' in child.material) child.material.metalness = 0.0;
            child.renderOrder = 1;
          } else {
            // Soft background cloud layer 1
            child.material.side = THREE.DoubleSide;
            child.material.transparent = true;
            child.material.depthWrite = false;
            child.material.alphaTest = 0.001;
            if ('roughness' in child.material) child.material.roughness = 1.0;
            if ('metalness' in child.material) child.material.metalness = 0.0;
            child.renderOrder = 2;
          }

          // Zero out specular/Fresnel glare in GLSL
          child.material.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <lights_fragment_end>',
              `
              reflectedLight.directSpecular = vec3( 0.0 );
              reflectedLight.indirectSpecular = vec3( 0.0 );
              #include <lights_fragment_end>
              `
            );
          };
        }
      });

      scene.add(cloudsContainer);
    },
    undefined,
    (err) => { console.warn('4K Clouds model note:', err); }
  );

  // 2. Floating 3D Magic Books
  loader.load(
    '/assets/models/%D0%BA%D0%BD%D0%B8%D0%B3%D0%B0.glb',
    (gltf) => {
      const bookTemplate = gltf.scene;
      
      const bookPositions = [
        { pos: new THREE.Vector3(2.2, 2.2, 1.0), rot: new THREE.Vector3(0.2, 0.4, -0.15), scale: 0.35, phase: 0.0 },
        { pos: new THREE.Vector3(-2.4, 2.0, -12.0), rot: new THREE.Vector3(-0.15, -0.6, 0.2), scale: 0.32, phase: 1.2 },
        { pos: new THREE.Vector3(2.8, 1.8, -25.0), rot: new THREE.Vector3(0.25, 0.8, -0.1), scale: 0.36, phase: 2.4 },
        { pos: new THREE.Vector3(-3.0, 1.7, -45.0), rot: new THREE.Vector3(-0.2, -0.4, 0.25), scale: 0.34, phase: 3.6 },
        { pos: new THREE.Vector3(2.4, 1.5, -62.0), rot: new THREE.Vector3(0.18, 0.5, -0.2), scale: 0.33, phase: 4.8 },
        { pos: new THREE.Vector3(-1.8, 1.3, -73.0), rot: new THREE.Vector3(-0.1, -0.7, 0.15), scale: 0.35, phase: 5.5 }
      ];

      bookPositions.forEach((bp) => {
        const book = bookTemplate.clone(true);
        book.position.copy(bp.pos);
        book.rotation.set(bp.rot.x, bp.rot.y, bp.rot.z);
        book.scale.setScalar(bp.scale);
        
        book.traverse((c) => {
          if (c.isMesh && c.material) {
            c.material = c.material.clone();
            c.material.side = THREE.DoubleSide;
          }
        });

        book.userData = {
          baseY: bp.pos.y,
          phase: bp.phase,
          rotSpeed: 0.006 + Math.random() * 0.004
        };

        scene.add(book);
        floatingBooks.push(book);
      });
    },
    undefined,
    (err) => { console.warn('Book model note:', err); }
  );

  // 3. Destination Portal at Z = -84
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
      portalContainer.position.set(0, 0, -84);

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
}

// ── 3D HANDWRITTEN STORY TYPOGRAPHY (True Oleg Ro Narrative) ──
function createHandwrittenText(badge, title, bodyLines, pos, rotY = 0, sectionIndex = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 1600, 900);

  // 1. Category Badge
  if (badge) {
    ctx.font = '700 24px "Space Mono", monospace';
    ctx.fillStyle = '#d8b888';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;
    ctx.fillText(badge.toUpperCase(), 800, 90);
  }

  // 2. Main Title in Casual Handwritten Script
  ctx.font = '700 52px "Caveat", "Marck Script", cursive';
  ctx.fillStyle = '#fff6ea';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(216, 184, 136, 0.95)';
  ctx.shadowBlur = 20;
  ctx.fillText(title, 800, 150);

  // 3. Story Paragraph Lines
  if (bodyLines && bodyLines.length > 0) {
    ctx.font = '500 32px "Caveat", "Marck Script", cursive';
    ctx.fillStyle = '#f2e6d6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 12;

    let y = 250;
    for (let i = 0; i < bodyLines.length; i++) {
      ctx.fillText(bodyLines[i], 800, y);
      y += 48;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    alphaTest: 0.02,
    opacity: sectionIndex === 0 ? 1.0 : 0.0
  });

  // Perfectly proportioned 3D plane that fills ~45% of the screen with spacious margins
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.9), mat);
  plane.position.copy(pos);
  plane.rotation.y = rotY;
  plane.userData = {
    baseY: pos.y,
    sectionIndex: sectionIndex
  };
  plane.renderOrder = 4;
  scene.add(plane);
  textPlanes.push(plane);
  return plane;
}

function build3DStoryTypography() {
  // Chapter 0: Prologue (Exact text from docs/txt.md)
  createHandwrittenText(
    'DEUSFLOW // ВСТУП',
    '«То що тебе сюди занесло?»',
    [
      'Пристебніть ремені: раз ви зайшли на цю сторінку, ви або дуже допитливі,',
      'або це випадковість і ви її вмить покинете… Хоча, може, погортаєш тут трохи?',
      'Ну ж бо… Я все ж намагався…'
    ],
    new THREE.Vector3(0.0, 2.2, -2.0),
    0,
    0
  );

  // Chapter 1: Childhood & Craft (Left side, slanted ~18 degrees)
  createHandwrittenText(
    '01 // ДИТИНСТВО ТА ТВОРЧІСТЬ',
    '«Любив щось творити і витворювати»',
    [
      'Усе життя, скільки себе пам\'ятаю, я любив щось творити і витворювати.',
      'Я любив малювати й перемальовувати з розмальовок картинки на свій лад…',
      'Уроки праці в мене були з дівчатами, оскільки хлопців було мало,',
      'тому ми там плели, вишивали і так далі…'
    ],
    new THREE.Vector3(-3.2, 1.8, -18.0),
    0.32,
    1
  );

  // Chapter 2: The First Camera & Crimea (Right side, slanted ~ -18 degrees)
  createHandwrittenText(
    '02 // ПЕРША КАМЕРА ТА КРИМ',
    '«Бабуся подарувала Olympus»',
    [
      'Бабуся подарувала на день народження мені плівкову камеру, це був Olympus…',
      'Через пару років з\'явився Canon 1000D. Я навіть не знав, навіщо об\'єктиви',
      'і як отримувати розмитий фон. Я просто фотографував, робив фотокопії чогось,',
      'особливо фотографії з Криму… Це був мій перший і останній «Крим».'
    ],
    new THREE.Vector3(3.2, 1.7, -38.0),
    -0.32,
    2
  );

  // Chapter 3: The Factory & Breakthrough (Left side, slanted ~17 degrees)
  createHandwrittenText(
    '03 // ЗАВОД ТА ПЕРЕЛОМНИЙ МОМЕНТ',
    '«Весілля мене обрали самі»',
    [
      'Я працював на заводі Ferrexpo Mining електриком — це пекельна праця за $400.',
      'У мене не було навіть надії на те, що я зможу стати фотографом…',
      'але тут диво: мене почали наймати на зйомки, і 90% з них були весільні.',
      'Тому я й кажу: весілля мене обрали самі :)'
    ],
    new THREE.Vector3(-3.0, 1.6, -58.0),
    0.30,
    3
  );

  // Chapter 4: Denmark & New Beginning (Facing Portal)
  createHandwrittenText(
    '04 // ДАНІЯ ТА НОВА СТОРІНКА',
    '«Історія в Данії тільки почалася»',
    [
      'У Данії 13 серпня дорогою до лікарні народився мій син Даніель.',
      'Історія мене в Данії ще не написана, вона тільки почалася…',
      'Давайте спостерігати разом, як зміниться ця сторінка :)'
    ],
    new THREE.Vector3(0.0, 1.4, -76.0),
    0,
    4
  );
}

// ── GSAP MAGNETIC SNAP SCROLL INTEGRATION ────────────────────
function initScrollTrigger() {
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.0,
    snap: {
      snapTo: [0.0, 0.25, 0.5, 0.75, 1.0], // Snaps gently to each chapter
      duration: { min: 0.4, max: 0.8 },
      delay: 0.15,
      ease: 'power2.out'
    },
    onUpdate: (self) => {
      targetScrollProgress = self.progress;
      const idx = Math.min(sectionMeta.length - 1, Math.round(self.progress * (sectionMeta.length - 1)));
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
  
  if (prefersReducedMotion) {
    const idx = Math.min(sectionMeta.length - 1, Math.round(targetScrollProgress * (sectionMeta.length - 1)));
    scrollProgress = idx / (sectionMeta.length - 1);
  } else {
    scrollProgress += (targetScrollProgress - scrollProgress) * 0.05;
  }

  // 1. Slalom Flythrough Kinematics
  if (cameraPathCurve && lookAtPathCurve) {
    const p = Math.max(0.001, Math.min(0.999, scrollProgress));
    
    const camPos = cameraPathCurve.getPointAt(p);
    
    // Subtle parallax mouse tilt
    const targetX = (mouseX / window.innerWidth) * 2 - 1;
    const targetY = -(mouseY / window.innerHeight) * 2 + 1;
    
    const desiredPos = new THREE.Vector3(
      camPos.x + targetX * 0.2,
      camPos.y + targetY * 0.15,
      camPos.z
    );

    playerCapsule.start.set(desiredPos.x, desiredPos.y - 0.4, desiredPos.z);
    playerCapsule.end.set(desiredPos.x, desiredPos.y + 0.4, desiredPos.z);

    if (worldOctree) {
      const hit = worldOctree.capsuleIntersect(playerCapsule);
      if (hit) {
        playerCapsule.translate(hit.normal.multiplyScalar(hit.depth));
      }
    }

    camera.position.set(
      (playerCapsule.start.x + playerCapsule.end.x) * 0.5,
      (playerCapsule.start.y + playerCapsule.end.y) * 0.5,
      playerCapsule.start.z
    );

    // Smooth camera gaze target squarely framing each chapter text
    const lookAtPos = lookAtPathCurve.getPointAt(p);
    camera.lookAt(lookAtPos);
  }

  // 2. Gentle Flying Ship Wave Bobbing
  if (shipMesh && !prefersReducedMotion) {
    shipMesh.position.y = Math.sin(time * 1.1) * 0.12;
    shipMesh.rotation.z = Math.sin(time * 0.7) * 0.025;
  }

  // 3. Animate Floating 3D Magic Books
  for (let i = 0; i < floatingBooks.length; i++) {
    const b = floatingBooks[i];
    if (!prefersReducedMotion) {
      b.rotation.y += b.userData.rotSpeed;
      b.position.y = b.userData.baseY + Math.sin(time * 1.3 + b.userData.phase) * 0.12;
      b.rotation.z = Math.sin(time * 0.8 + b.userData.phase) * 0.06;
    }
  }

  // 4. Fade Text Plates per Chapter with Smooth Highlight
  for (let i = 0; i < textPlanes.length; i++) {
    const p = textPlanes[i];
    const targetProgress = p.userData.sectionIndex / (textPlanes.length - 1);
    const diff = Math.abs(scrollProgress - targetProgress);
    const alpha = prefersReducedMotion ? (diff < 0.05 ? 1.0 : 0.0) : Math.max(0.0, Math.min(1.0, 1.0 - (diff / 0.16)));
    
    p.material.opacity = alpha;
    p.visible = alpha > 0.02;
    if (!prefersReducedMotion) {
      p.position.y = p.userData.baseY + Math.sin(time * 0.8 + p.position.z * 0.1) * 0.05;
    }
  }

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
