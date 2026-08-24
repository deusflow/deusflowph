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

let cloudsObject;

// DOM Elements
const hudSceneTitle = document.getElementById('hud-scene-title');
const hudTimecode = document.getElementById('hud-timecode');
const hudActLabel = document.getElementById('hud-act-label');

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
    new THREE.Vector3(0, -2, -15),
    new THREE.Vector3(0, -4, -35),
    new THREE.Vector3(0, -5, -60),
    new THREE.Vector3(0, -6, -80)
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
  createFloatingText('ВСТУП', new THREE.Vector3(4, -2, -20), -0.25, 62, '#fce2b8');
  createFloatingText('КРІЗЬ ХМАРИ', new THREE.Vector3(-4.5, -3, -38), 0.25, 58, '#e8dcc0');
  createFloatingText('ПРОСТІР ДУМОК', new THREE.Vector3(3.5, -4, -62), -0.2, 58, '#fce2b8');
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

  // Calculate HUD changes based on scroll progress instead of sections
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      const idx = Math.floor(self.progress * (sectionMeta.length - 1));
      updateHUD(idx);
    }
  });
}

function updateHUD(index) {
  const meta = sectionMeta[index] || sectionMeta[0];
  if (hudSceneTitle) hudSceneTitle.innerText = meta.title;
  if (hudTimecode) hudTimecode.innerText = meta.timecode;
  if (hudActLabel) hudActLabel.innerText = meta.act;
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

  // Clouds slow ambient movement
  if (cloudsObject) {
    cloudsObject.rotation.y = time * 0.015;
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
