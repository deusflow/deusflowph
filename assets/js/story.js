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

let books = [];
let portal;
let cloudsObject;

// DOM Elements
const hudSceneTitle = document.getElementById('hud-scene-title');
const hudTimecode = document.getElementById('hud-timecode');
const hudActLabel = document.getElementById('hud-act-label');
const stepDots = document.querySelectorAll('.step-dot');

const sectionMeta = [
  { title: 'PROLOGUE // THE CLOUDS', timecode: 'FOLIO 01 / 05', act: 'ACT I // ROOTS' },
  { title: '01 // THE CRAFT', timecode: 'FOLIO 02 / 05', act: 'ACT I // ROOTS' },
  { title: '02 // THE SILHOUETTE', timecode: 'FOLIO 03 / 05', act: 'ACT I // ROOTS' },
  { title: '03 // THE MEMORY', timecode: 'FOLIO 04 / 05', act: 'ACT I // ROOTS' },
  { title: 'EPILOGUE // THE PORTAL', timecode: 'FOLIO 05 / 05', act: 'ACT I // ROOTS' }
];

document.addEventListener('DOMContentLoaded', () => {
  initThree();
  buildSplinePath();
  loadAssets();
  buildMiseEnScene();
  initScrollTrigger();
  initMouseListener();
  animate();
});

function initThree() {
  const canvas = document.getElementById('webgl-canvas');
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0d0a08, 0.012);

  cameraGroup = new THREE.Group();
  scene.add(cameraGroup);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 300);
  cameraGroup.add(camera);

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  window.addEventListener('resize', onWindowResize);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffeedd, 1.2));
  const dirLight = new THREE.DirectionalLight(0xffd59e, 2.0);
  dirLight.position.set(15, 30, 20);
  scene.add(dirLight);

  const warmPoint = new THREE.PointLight(0xffa347, 3.0, 60);
  warmPoint.position.set(0, 5, -30);
  scene.add(warmPoint);
}

// ── SPLINE PATH ──────────────────────────────────────────────
function buildSplinePath() {
  cameraCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 10),
    new THREE.Vector3(2, 1.5, -15),
    new THREE.Vector3(-2.5, 0.5, -35),
    new THREE.Vector3(3, -0.5, -55),
    new THREE.Vector3(-1.5, 1.5, -75),
    new THREE.Vector3(0, 0, -92),
    new THREE.Vector3(0, 0, -100)
  ]);
  cameraCurve.tension = 0.5;
}

// ── LOAD GLTF ASSETS ─────────────────────────────────────────
function loadAssets() {
  const loader = new GLTFLoader();

  // 1. Clouds
  loader.load(
    '/assets/models/%D0%BE%D0%B1%D0%BB%D0%B0%D0%BA%D0%B0%20%D1%81%20%D1%87%D0%B5%D0%B3%D0%BE%20%D0%BD%D0%B0%D1%87%D0%B8%D0%BD%D0%B0%D0%B5%D0%BC.glb',
    (gltf) => {
      cloudsObject = gltf.scene;
      cloudsObject.position.set(0, -6, -45);
      cloudsObject.scale.setScalar(6.0);
      scene.add(cloudsObject);
    },
    undefined,
    (err) => { console.warn('Clouds model note:', err); }
  );

  // 2. Portal
  loader.load(
    '/assets/models/%D0%BF%D0%BE%D1%80%D1%82%D0%B0%D0%BB2.glb',
    (gltf) => {
      portal = gltf.scene;
      portal.position.set(0, -1, -95);
      portal.scale.setScalar(2.5);
      scene.add(portal);
    },
    undefined,
    (err) => { console.warn('Portal model note:', err); }
  );

  // 3. Book 1
  loader.load(
    '/assets/models/%D0%BA%D0%BD%D0%B8%D0%B3%D0%B0.glb',
    (gltf) => {
      for (let i = 0; i < 6; i++) {
        const b = gltf.scene.clone();
        b.position.set(
          (Math.random() - 0.5) * 18,
          (Math.random() - 0.5) * 8,
          -15 - Math.random() * 60
        );
        b.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        );
        b.scale.setScalar(2.5);
        b.userData = {
          rotSpeedX: (Math.random() - 0.5) * 0.015,
          rotSpeedY: (Math.random() - 0.5) * 0.015,
          baseY: b.position.y,
          floatSpeed: Math.random() * 1.5 + 0.8,
          offset: Math.random() * 10
        };
        scene.add(b);
        books.push(b);
      }
    },
    undefined,
    (err) => { console.warn('Book 1 model note:', err); }
  );

  // 4. Book 2
  loader.load(
    '/assets/models/%D0%BA%D0%BD%D0%B8%D0%B3%D0%B02.glb',
    (gltf) => {
      for (let i = 0; i < 6; i++) {
        const b = gltf.scene.clone();
        b.position.set(
          (Math.random() - 0.5) * 18,
          (Math.random() - 0.5) * 8,
          -15 - Math.random() * 60
        );
        b.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        );
        b.scale.setScalar(2.2);
        b.userData = {
          rotSpeedX: (Math.random() - 0.5) * 0.015,
          rotSpeedY: (Math.random() - 0.5) * 0.015,
          baseY: b.position.y,
          floatSpeed: Math.random() * 1.5 + 0.8,
          offset: Math.random() * 10
        };
        scene.add(b);
        books.push(b);
      }
    },
    undefined,
    (err) => { console.warn('Book 2 model note:', err); }
  );
}

// ── NATIVE CANVAS 3D TEXT (Zero External Dependencies) ───────
function createFloatingText(str, pos, rotY, fontSize = 60, color = '#fce2b8') {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 1024, 256);
  ctx.font = `700 ${fontSize}px "Cinzel", "Playfair Display", Georgia, serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(216, 184, 136, 0.7)';
  ctx.shadowBlur = 18;
  ctx.fillText(str, 512, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), mat);
  plane.position.copy(pos);
  plane.rotation.y = rotY;
  scene.add(plane);
  return plane;
}

// ── MISE EN SCÈNE ────────────────────────────────────────────
function buildMiseEnScene() {
  createFloatingText('THE BEGINNING', new THREE.Vector3(4, 2, -15), -0.25, 62, '#fce2b8');
  createFloatingText('MOMENTS DRIFT', new THREE.Vector3(-4.5, 1, -38), 0.25, 58, '#e8dcc0');
  createFloatingText('THE ARCHIVE', new THREE.Vector3(3.5, 0, -62), -0.2, 58, '#fce2b8');
  createFloatingText('THE PORTAL', new THREE.Vector3(0, 3.5, -88), 0, 64, '#ffd9a0');

  // Photo Planes
  const planeGeo = new THREE.PlaneGeometry(6, 4);

  const photoVertexShader = [
    'uniform float uTime;',
    'uniform float uVelocity;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  vec3 p = position;',
    '  p.z += sin(p.y * 3.0 + uTime) * uVelocity * 0.003;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
    '}'
  ].join('\n');

  const photoFragmentShader = [
    'uniform sampler2D tMap;',
    'uniform float uVelocity;',
    'varying vec2 vUv;',
    'void main() {',
    '  float shift = uVelocity * 0.0015;',
    '  float r = texture2D(tMap, vUv + vec2(shift, 0.0)).r;',
    '  float g = texture2D(tMap, vUv).g;',
    '  float b = texture2D(tMap, vUv - vec2(shift, 0.0)).b;',
    '  gl_FragColor = vec4(r, g, b, 1.0);',
    '}'
  ].join('\n');

  function createPhotoPlane(url, pos, rot) {
    const tex = new THREE.TextureLoader().load(url);
    const mat = new THREE.ShaderMaterial({
      vertexShader: photoVertexShader,
      fragmentShader: photoFragmentShader,
      uniforms: {
        tMap: { value: tex },
        uTime: { value: 0 },
        uVelocity: { value: 0 }
      },
      transparent: true,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(planeGeo, mat);
    mesh.position.copy(pos);
    mesh.rotation.copy(rot);
    mesh.userData.isPhoto = true;
    mesh.userData.baseY = pos.y;
    scene.add(mesh);
  }

  createPhotoPlane('/assets/textures/unsplash_film.jpg', new THREE.Vector3(4, 2.5, -25), new THREE.Euler(0, -0.3, 0));
  createPhotoPlane('/assets/textures/unsplash_silhouette.jpg', new THREE.Vector3(-4, 0.5, -48), new THREE.Euler(0, 0.3, 0));
  createPhotoPlane('/assets/textures/unsplash_memory.jpg', new THREE.Vector3(3.5, 1.8, -68), new THREE.Euler(0, -0.2, 0));
  createPhotoPlane('/assets/textures/unsplash_frame.jpg', new THREE.Vector3(-3, 1, -85), new THREE.Euler(0, 0.2, 0));

  // Hide static DOM images
  document.querySelectorAll('.webgl-sync').forEach((el) => { el.style.opacity = '0'; });
}

// ── GSAP SCROLL ──────────────────────────────────────────────
function initScrollTrigger() {
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.2,
    onUpdate: (self) => {
      targetScrollProgress = self.progress;
    }
  });

  window.addEventListener('scroll', () => {
    const currentY = window.scrollY;
    scrollVelocity = currentY - lastScrollY;
    lastScrollY = currentY;
  });

  const sections = document.querySelectorAll('.story-section');
  sections.forEach((sec, idx) => {
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 50%',
      end: 'bottom 50%',
      onEnter: () => { updateHUD(idx); },
      onEnterBack: () => { updateHUD(idx); }
    });
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

// ── ANIMATION LOOP ───────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();

  scrollVelocity *= 0.9;
  scrollProgress += (targetScrollProgress - scrollProgress) * 0.06;

  // Camera along spline
  if (cameraCurve) {
    const p = Math.max(0.001, Math.min(0.999, scrollProgress));
    const camPos = cameraCurve.getPointAt(p);
    cameraGroup.position.copy(camPos);

    const lookAheadP = Math.min(0.999, p + 0.035);
    const lookAtPos = cameraCurve.getPointAt(lookAheadP);
    cameraGroup.lookAt(lookAtPos);
  }

  // Mouse parallax
  const targetX = (mouseX / window.innerWidth) * 2 - 1;
  const targetY = -(mouseY / window.innerHeight) * 2 + 1;
  camera.position.x += (targetX * 0.4 - camera.position.x) * 0.05;
  camera.position.y += (targetY * 0.4 - camera.position.y) * 0.05;

  // Animate floating books
  for (let i = 0; i < books.length; i++) {
    const b = books[i];
    b.rotation.x += b.userData.rotSpeedX;
    b.rotation.y += b.userData.rotSpeedY;
    b.position.y = b.userData.baseY + Math.sin(time * b.userData.floatSpeed + b.userData.offset) * 0.4;
  }

  // Photos
  scene.traverse((child) => {
    if (child.userData && child.userData.isPhoto && child.material && child.material.uniforms) {
      child.material.uniforms.uTime.value = time;
      child.material.uniforms.uVelocity.value = THREE.MathUtils.lerp(
        child.material.uniforms.uVelocity.value,
        scrollVelocity,
        0.1
      );
      child.position.y = child.userData.baseY + Math.sin(time + child.position.z) * 0.2;
    }
  });

  // Clouds slow ambient movement
  if (cloudsObject) {
    cloudsObject.rotation.y = time * 0.015;
  }

  // Portal rotation
  if (portal) {
    portal.rotation.z = time * 0.15;
    portal.rotation.y = Math.sin(time * 0.3) * 0.1;
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
