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

let cameraPathCurve;
let lookAtPathCurve;

let cloudsContainer;
let shipMesh;
let portalMesh;
let textPlanes = [];

// Golden Sun Dust Motes System
let sunDustMesh;
const DUST_COUNT = 160;
const dustData = [];

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
  document.fonts.ready.then(() => {
    initThree();
    initCollisionSystem();
    buildSlalomPath();
    loadAssets();
    initSunDust();
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

// ── ATMOSPHERIC GOLDEN SUN DUST MOTES ─────────────────────────
function initSunDust() {
  const geo = new THREE.TetrahedronGeometry(0.07, 0);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffe4b5,
    transparent: true,
    opacity: 0.85
  });

  sunDustMesh = new THREE.InstancedMesh(geo, mat, DUST_COUNT);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < DUST_COUNT; i++) {
    const x = (Math.random() - 0.5) * 22;
    const y = 0.4 + Math.random() * 4.5;
    const z = 12 - Math.random() * 96;
    const scale = 0.6 + Math.random() * 1.3;

    dummy.position.set(x, y, z);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    sunDustMesh.setMatrixAt(i, dummy.matrix);

    dustData.push({
      baseX: x,
      baseY: y,
      baseZ: z,
      scale: scale,
      speed: 0.4 + Math.random() * 0.5,
      rotSpeed: (Math.random() - 0.5) * 0.02,
      phase: Math.random() * Math.PI * 2
    });
  }

  sunDustMesh.instanceMatrix.needsUpdate = true;
  sunDustMesh.renderOrder = 3;
  scene.add(sunDustMesh);
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

// ── SLALOM CAMERA & LOOK-AT CHOREOGRAPHY ──────────────────────
function buildSlalomPath() {
  // 1. Camera Eye Position Path: Weaves left & right around the ship and aligns squarely with each text
  cameraPathCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 1.8, 8.5),     // Beat 0: Hero overview of the sky and floating ship
    new THREE.Vector3(-2.8, 1.7, -14.0),  // Beat 1: Glides left around ship, aligns squarely with Text 1
    new THREE.Vector3(2.8, 1.6, -34.0),   // Beat 2: Sweeps diagonally right, aligns squarely with Text 2
    new THREE.Vector3(-2.5, 1.5, -54.0),  // Beat 3: Sweeps diagonally left, aligns squarely with Text 3
    new THREE.Vector3(0.0, 1.3, -71.0),   // Beat 4: Enters center approaching the Portal
    new THREE.Vector3(0.0, 1.2, -81.0)    // Beat 5: Stepping into the Portal
  ]);
  cameraPathCurve.tension = 0.45;

  // 2. Camera Gaze Target Path: Points directly at the slanted text cards and straightens out on arrival
  lookAtPathCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 1.8, 1.0),     // Beat 0 LookAt: Center prologue
    new THREE.Vector3(-3.8, 1.6, -18.0),  // Beat 1 LookAt: Left slanted Text 1
    new THREE.Vector3(3.8, 1.5, -38.0),   // Beat 2 LookAt: Right slanted Text 2
    new THREE.Vector3(-3.5, 1.4, -58.0),  // Beat 3 LookAt: Left slanted Text 3
    new THREE.Vector3(0.0, 1.2, -76.0),   // Beat 4 LookAt: Portal epilogue
    new THREE.Vector3(0.0, 1.2, -85.0)    // Beat 5 LookAt: Inside Portal core
  ]);
  lookAtPathCurve.tension = 0.45;

  const startPos = cameraPathCurve.getPointAt(0.001);
  const lookPos = lookAtPathCurve.getPointAt(0.001);
  camera.position.copy(startPos);
  camera.lookAt(lookPos);
}

// ── LOAD 3D ASSETS ────────────────────────────────────────────
function loadAssets() {
  const loader = new GLTFLoader();

  // 1. Original 4K Clouds Model & Ship
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
            child.material.side = THREE.BackSide;
            child.material.depthWrite = false;
            child.material.transparent = false;
            child.renderOrder = 0;
          } else if (child.name && child.name.includes('Boot')) {
            shipMesh = child;
            child.material.side = THREE.DoubleSide;
            child.material.depthWrite = true;
            child.material.transparent = false;
            if ('roughness' in child.material) child.material.roughness = 0.7;
            if ('metalness' in child.material) child.material.metalness = 0.0;
            child.renderOrder = 1;
          } else if (child.name && child.name.includes('Poly')) {
            child.material.side = THREE.DoubleSide;
            child.material.depthWrite = true;
            child.material.transparent = false;
            if ('roughness' in child.material) child.material.roughness = 1.0;
            if ('metalness' in child.material) child.material.metalness = 0.0;
            child.renderOrder = 1;
          } else {
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

  // 2. Destination Portal at Z = -84
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

// ── 3D SLANTED STORY TYPOGRAPHY ───────────────────────────────
function createSlanted3DText(badge, title, subtitle, pos, rotY = 0, sectionIndex = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

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
  ctx.shadowColor = 'rgba(216, 184, 136, 0.95)';
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

  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    alphaTest: 0.02,
    opacity: sectionIndex === 0 ? 1.0 : 0.0
  });

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 4.25), mat);
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
  // Beat 0: Prologue (Center Front)
  createSlanted3DText(
    'DEUSFLOW ARCHIVES · FOLIO 00',
    'Олег Ро',
    'Ніч у чарівній бібліотеці: історія про те, як дитяча допитливість перетворюється на ремесло.',
    new THREE.Vector3(0, 1.8, 1),
    0,
    0
  );

  // Beat 1: Childhood & Craft (Left side, slanted diagonally into the distance)
  createSlanted3DText(
    '01 // CRAFT & EMBROIDERY',
    'Дитяча Допитливість',
    'Усе життя я любив малювати й перемальовувати картинки на свій лад. Праця, вишивка та перші кроки у світ форми.',
    new THREE.Vector3(-3.8, 1.6, -18),
    0.32, // Slanted ~18 degrees into the distance
    1
  );

  // Beat 2: The First Lens (Right side, slanted diagonally into the distance)
  createSlanted3DText(
    '02 // THE FIRST LENS · 35MM',
    'Олімпус та Крим',
    'Бабуся подарувала мені плівкову камеру. Перші невпевнені кадри, море, Крим та зародження любові до світла.',
    new THREE.Vector3(3.8, 1.5, -38),
    -0.32, // Slanted ~ -18 degrees into the distance
    2
  );

  // Beat 3: Digital Dawn (Left side, slanted diagonally into the distance)
  createSlanted3DText(
    '03 // DIGITAL DAWN · CANON EOS',
    'Пошук Власного Почерку',
    'Через пару років з’явився Canon 1000D. Сотні туторіалів, ночі за фотошопом та візуальна поезія.',
    new THREE.Vector3(-3.5, 1.4, -58),
    0.28, // Slanted ~16 degrees into the distance
    3
  );

  // Beat 4: Epilogue (Facing the glowing Portal)
  createSlanted3DText(
    'EPILOGUE // THE PORTAL',
    'Заклинання Миті',
    'Кожен кадр — це заклинання, що затримує мить, яка більше ніколи не повториться.',
    new THREE.Vector3(0, 1.2, -76),
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
    scrub: 1.2,
    snap: {
      snapTo: [0.0, 0.25, 0.5, 0.75, 1.0], // Snaps to exactly each of the 5 chapters
      duration: { min: 0.35, max: 0.75 },
      delay: 0.12,
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
  scrollProgress += (targetScrollProgress - scrollProgress) * 0.06;

  // 1. Slalom Flythrough Kinematics
  if (cameraPathCurve && lookAtPathCurve) {
    const p = Math.max(0.001, Math.min(0.999, scrollProgress));
    
    // Smooth camera position along the slalom curve
    const camPos = cameraPathCurve.getPointAt(p);
    
    // Subtle parallax mouse tilt
    const targetX = (mouseX / window.innerWidth) * 2 - 1;
    const targetY = -(mouseY / window.innerHeight) * 2 + 1;
    
    const desiredPos = new THREE.Vector3(
      camPos.x + targetX * 0.25,
      camPos.y + targetY * 0.18,
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

    // Smooth camera gaze target that squarely aligns with the current chapter text
    const lookAtPos = lookAtPathCurve.getPointAt(p);
    camera.lookAt(lookAtPos);
  }

  // 2. Animate Golden Sun Dust Motes
  if (sunDustMesh) {
    const dummy = new THREE.Object3D();
    for (let i = 0; i < DUST_COUNT; i++) {
      const d = dustData[i];
      const y = d.baseY + Math.sin(time * d.speed + d.phase) * 0.2;
      const x = d.baseX + Math.cos(time * 0.3 + d.phase) * 0.15;
      
      dummy.position.set(x, y, d.baseZ);
      dummy.rotation.set(time * d.rotSpeed, time * d.rotSpeed * 1.2, 0);
      dummy.scale.setScalar(d.scale * (0.8 + 0.2 * Math.sin(time * 2.0 + d.phase)));
      dummy.updateMatrix();
      sunDustMesh.setMatrixAt(i, dummy.matrix);
    }
    sunDustMesh.instanceMatrix.needsUpdate = true;
  }

  // 3. Gentle Flying Ship Wave Bobbing
  if (shipMesh) {
    shipMesh.position.y = Math.sin(time * 1.1) * 0.12;
    shipMesh.rotation.z = Math.sin(time * 0.7) * 0.025;
  }

  // 4. Fade Text Plates per Chapter with Smooth Highlight
  for (let i = 0; i < textPlanes.length; i++) {
    const p = textPlanes[i];
    const targetProgress = p.userData.sectionIndex / (textPlanes.length - 1);
    const diff = Math.abs(scrollProgress - targetProgress);
    const alpha = Math.max(0.0, Math.min(1.0, 1.0 - (diff / 0.16)));
    
    p.material.opacity = alpha;
    p.visible = alpha > 0.02;
    p.position.y = p.userData.baseY + Math.sin(time * 0.8 + p.position.z * 0.1) * 0.06;
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
