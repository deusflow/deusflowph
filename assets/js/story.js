import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Text } from 'troika-three-text';

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

document.addEventListener('DOMContentLoaded', async () => {
  initThree();
  buildSplinePath();
  await loadAssets();
  await buildMiseEnScene();
  initScrollTrigger();
  initMouseListener();
  animate();
});

function initThree() {
  const canvas = document.getElementById('webgl-canvas');
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0d0a08, 0.015);
  
  cameraGroup = new THREE.Group();
  scene.add(cameraGroup);
  
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
  cameraGroup.add(camera);
  
  renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  window.addEventListener('resize', onWindowResize);

  // Lighting for the models
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dirLight = new THREE.DirectionalLight(0xffddaa, 1.5);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);
}

// --------------------------------------------------------------------------
// SPLINE PATH
// --------------------------------------------------------------------------
function buildSplinePath() {
  cameraCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 10),      // Start
    new THREE.Vector3(2, 2, -10),     // Enter clouds
    new THREE.Vector3(-2, 1, -30),    // Through books
    new THREE.Vector3(3, -1, -50),    // Through books & photos
    new THREE.Vector3(-2, 2, -70),    // Approaching portal
    new THREE.Vector3(0, 0, -90),     // At portal threshold
    new THREE.Vector3(0, 0, -100)     // Into the portal
  ]);
  cameraCurve.tension = 0.5;
}

// --------------------------------------------------------------------------
// LOAD ASSETS
// --------------------------------------------------------------------------
async function loadAssets() {
  const loader = new GLTFLoader();
  
  return new Promise((resolve) => {
    let loadedCount = 0;
    const totalAssets = 4;
    
    const checkComplete = () => {
      loadedCount++;
      if (loadedCount >= totalAssets) resolve();
    };

    // 1. Clouds
    loader.load('/assets/models/облака с чего начинаем.glb', (gltf) => {
      const clouds = gltf.scene;
      clouds.position.set(0, -5, -40); // Center clouds in the journey
      clouds.scale.setScalar(5.0);     // Scale up to envelop the path
      scene.add(clouds);
      checkComplete();
    }, undefined, checkComplete);

    // 2. Portal
    loader.load('/assets/models/портал2.glb', (gltf) => {
      portal = gltf.scene;
      portal.position.set(0, -2, -95); // Place at the end of the spline
      portal.scale.setScalar(2.0);
      scene.add(portal);
      checkComplete();
    }, undefined, checkComplete);

    // 3. Book 1
    loader.load('/assets/models/книга.glb', (gltf) => {
      // Create multiple instances floating around
      for (let i = 0; i < 5; i++) {
        const b = gltf.scene.clone();
        b.position.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 10, -20 - Math.random() * 50);
        b.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        b.scale.setScalar(2.0);
        
        b.userData = {
          rotSpeedX: (Math.random() - 0.5) * 0.02,
          rotSpeedY: (Math.random() - 0.5) * 0.02,
          baseY: b.position.y,
          floatSpeed: Math.random() * 2 + 1,
          offset: Math.random() * 10
        };
        scene.add(b);
        books.push(b);
      }
      checkComplete();
    }, undefined, checkComplete);

    // 4. Book 2
    loader.load('/assets/models/книга2.glb', (gltf) => {
      for (let i = 0; i < 5; i++) {
        const b = gltf.scene.clone();
        b.position.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 10, -20 - Math.random() * 50);
        b.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        b.scale.setScalar(2.0);
        
        b.userData = {
          rotSpeedX: (Math.random() - 0.5) * 0.02,
          rotSpeedY: (Math.random() - 0.5) * 0.02,
          baseY: b.position.y,
          floatSpeed: Math.random() * 2 + 1,
          offset: Math.random() * 10
        };
        scene.add(b);
        books.push(b);
      }
      checkComplete();
    }, undefined, checkComplete);
  });
}

// --------------------------------------------------------------------------
// MISE EN SCÈNE (Photos & Text)
// --------------------------------------------------------------------------
async function buildMiseEnScene() {
  const createFloatingText = (str, pos, rotY) => {
    const txt = new Text();
    txt.text = str;
    txt.fontSize = 1.5;
    txt.font = "https://fonts.gstatic.com/s/cinzel/v19/8vIJ7qcw3PEtcqCGzCwjI7Lg_xY.woff2"; // Or a handwriting font
    txt.position.copy(pos);
    txt.rotation.y = rotY;
    txt.color = 0xffffff;
    txt.anchorX = 'center';
    txt.anchorY = 'middle';
    scene.add(txt);
    txt.sync();
  };

  createFloatingText("THE BEGINNING", new THREE.Vector3(5, 2, -15), -0.3);
  createFloatingText("MOMENTS DRIFT", new THREE.Vector3(-5, 1, -35), 0.3);
  createFloatingText("THE ARCHIVE", new THREE.Vector3(4, 0, -60), -0.2);

  // Unsplash Photos as WebGL Planes
  const planeGeo = new THREE.PlaneGeometry(6, 4); 
  const createPhotoPlane = (url, pos, rot) => {
    const tex = new THREE.TextureLoader().load(url);
    const mat = new THREE.ShaderMaterial({
      vertexShader: \`
        uniform float uTime;
        uniform float uVelocity;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.z += sin(p.y * 3.0 + uTime) * uVelocity * 0.003;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      \`,
      fragmentShader: \`
        uniform sampler2D tMap;
        uniform float uVelocity;
        varying vec2 vUv;
        void main() {
          float shift = uVelocity * 0.0015;
          float r = texture2D(tMap, vUv + vec2(shift, 0.0)).r;
          float g = texture2D(tMap, vUv).g;
          float b = texture2D(tMap, vUv - vec2(shift, 0.0)).b;
          gl_FragColor = vec4(r, g, b, 1.0);
        }
      \`,
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
  };

  createPhotoPlane('/assets/textures/unsplash_film.jpg', new THREE.Vector3(4, 3, -25), new THREE.Euler(0, -0.3, 0));
  createPhotoPlane('/assets/textures/unsplash_silhouette.jpg', new THREE.Vector3(-4, 0, -45), new THREE.Euler(0, 0.3, 0));
  createPhotoPlane('/assets/textures/unsplash_memory.jpg', new THREE.Vector3(3, 2, -65), new THREE.Euler(0, -0.2, 0));
  createPhotoPlane('/assets/textures/unsplash_frame.jpg', new THREE.Vector3(-3, 1, -85), new THREE.Euler(0, 0.2, 0));

  document.querySelectorAll('.webgl-sync').forEach(el => el.style.opacity = '0');
}

// --------------------------------------------------------------------------
// GSAP SCROLL & LOGIC
// --------------------------------------------------------------------------
function initScrollTrigger() {
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.5,
    onUpdate: (self) => {
      targetScrollProgress = self.progress;
    }
  });

  window.addEventListener('scroll', () => {
    const currentY = window.scrollY;
    scrollVelocity = (currentY - lastScrollY);
    lastScrollY = currentY;
  });
  
  const sections = document.querySelectorAll('.story-section');
  sections.forEach((sec, idx) => {
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 50%',
      end: 'bottom 50%',
      onEnter: () => updateHUD(idx),
      onEnterBack: () => updateHUD(idx)
    });
  });
}

function updateHUD(index) {
  const meta = sectionMeta[index] || sectionMeta[0];
  hudSceneTitle.innerText = meta.title;
  hudTimecode.innerText = meta.timecode;
  hudActLabel.innerText = meta.act;
  stepDots.forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
}

// --------------------------------------------------------------------------
// ANIMATION LOOP
// --------------------------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();

  scrollVelocity *= 0.9;
  scrollProgress += (targetScrollProgress - scrollProgress) * 0.05;
  
  // Camera movement along spline
  if (cameraCurve) {
    const p = Math.max(0.001, Math.min(0.999, scrollProgress));
    const camPos = cameraCurve.getPointAt(p);
    cameraGroup.position.copy(camPos);
    
    const lookAheadP = Math.min(0.999, p + 0.03);
    const lookAtPos = cameraCurve.getPointAt(lookAheadP);
    cameraGroup.lookAt(lookAtPos);
  }

  // Smooth mouse parallax
  const targetX = (mouseX / window.innerWidth) * 2 - 1;
  const targetY = -(mouseY / window.innerHeight) * 2 + 1;
  camera.position.x += (targetX * 0.3 - camera.position.x) * 0.05;
  camera.position.y += (targetY * 0.3 - camera.position.y) * 0.05;

  // Animate floating books
  books.forEach(b => {
    b.rotation.x += b.userData.rotSpeedX;
    b.rotation.y += b.userData.rotSpeedY;
    b.position.y = b.userData.baseY + Math.sin(time * b.userData.floatSpeed + b.userData.offset) * 0.5;
  });

  // Animate photos & portal
  scene.traverse((child) => {
    if (child.userData.isPhoto) {
      if (child.material.uniforms) {
        child.material.uniforms.uTime.value = time;
        child.material.uniforms.uVelocity.value = THREE.MathUtils.lerp(
          child.material.uniforms.uVelocity.value,
          scrollVelocity,
          0.1
        );
      }
      child.position.y = child.userData.baseY + Math.sin(time + child.position.z) * 0.2;
    }
  });

  if (portal) {
    portal.rotation.y = time * 0.1; // Slowly rotate the portal
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
