import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Text } from 'troika-three-text';

const DUST_COUNT = 150;
const EMBER_COUNT = 40;

let scene, camera, renderer;
let clock = new THREE.Clock();

let dustMesh, dustMaterial, dustGeometry;
let emberMesh, emberMaterial, emberGeometry;

let mouseX = 0, mouseY = 0;
let scrollProgress = 0.0;
let targetScrollProgress = 0.0;
let scrollVelocity = 0.0;
let lastScrollY = 0;

let cameraCurve;
let cameraGroup;

// DOM Elements
const hudSceneTitle = document.getElementById('hud-scene-title');
const hudTimecode = document.getElementById('hud-timecode');
const hudActLabel = document.getElementById('hud-act-label');
const stepDots = document.querySelectorAll('.step-dot');

const sectionMeta = [
  { title: 'PROLOGUE // THE THRESHOLD', timecode: 'FOLIO 01 / 06', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: 'FOLIO 01 // THE INITIATION', timecode: 'FOLIO 02 / 06', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: '01 // CRAFT & EMBROIDERY', timecode: 'FOLIO 03 / 06', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: '02 // THE FIRST LENS · 35MM', timecode: 'FOLIO 04 / 06', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: '03 // CANON 1000D · DIGITAL', timecode: 'FOLIO 05 / 06', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: 'EPILOGUE // THE STILLNESS', timecode: 'FOLIO 06 / 06', act: 'ACT I // ROOTS & THE FIRST LENS' }
];

document.addEventListener('DOMContentLoaded', async () => {
  initThree();
  buildDustMotes();
  buildEmbers();
  buildSplinePath();
  await buildMiseEnScene();
  initScrollTrigger();
  initMouseListener();
  animate();
});

function initThree() {
  const canvas = document.getElementById('webgl-canvas');
  scene = new THREE.Scene();
  
  cameraGroup = new THREE.Group();
  scene.add(cameraGroup);
  
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  cameraGroup.add(camera);
  
  renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  window.addEventListener('resize', onWindowResize);
  
  // Ambient lighting
  scene.add(new THREE.AmbientLight(0xffeedd, 0.5));
  const dirLight = new THREE.DirectionalLight(0xffddaa, 1.5);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);
}

// --------------------------------------------------------------------------
// SPLINE PATH
// --------------------------------------------------------------------------
function buildSplinePath() {
  cameraCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 10),
    new THREE.Vector3(2, 1, 0),
    new THREE.Vector3(-2, -1, -10),
    new THREE.Vector3(0, 0, -20),
    new THREE.Vector3(3, 2, -30),
    new THREE.Vector3(0, 0, -40)
  ]);
  cameraCurve.tension = 0.5;
  
  // Debug line (optional, set visible to false)
  const points = cameraCurve.getPoints(50);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.0 });
  const curveObject = new THREE.Line(geometry, material);
  scene.add(curveObject);
}

// --------------------------------------------------------------------------
// MISE EN SCÈNE (3D Objects in Space)
// --------------------------------------------------------------------------
async function buildMiseEnScene() {
  // 1. 3D Text (Title)
  const myText = new Text();
  myText.text = "ОЛЕГ РО\\nARCHIVE";
  myText.fontSize = 1.2;
  myText.font = "https://fonts.gstatic.com/s/cinzel/v19/8vIJ7qcw3PEtcqCGzCwjI7Lg_xY.woff2";
  myText.position.set(1.5, 0.5, 3);
  myText.rotation.y = -0.2;
  myText.color = 0xffeedd;
  myText.anchorX = 'center';
  myText.anchorY = 'middle';
  scene.add(myText);
  myText.sync();

  // 2. Photos as WebGL Planes
  const planeGeo = new THREE.PlaneGeometry(16, 9); // standard aspect ratio, scaled down later
  
  const createPhotoPlane = (url, pos, rot, scale) => {
    const tex = new THREE.TextureLoader().load(url);
    const mat = new THREE.ShaderMaterial({
      vertexShader: \`
        uniform float uTime;
        uniform float uVelocity;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.z += sin(p.y * 5.0 + uTime) * uVelocity * 0.005;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      \`,
      fragmentShader: \`
        uniform sampler2D tMap;
        uniform float uVelocity;
        varying vec2 vUv;
        void main() {
          float shift = uVelocity * 0.002;
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
    mesh.scale.setScalar(scale);
    mesh.userData.isPhoto = true;
    scene.add(mesh);
    return mesh;
  };

  createPhotoPlane('/assets/textures/embroidery_threads.jpg', new THREE.Vector3(-1.5, -0.5, -5), new THREE.Euler(0, 0.3, 0), 0.3);
  createPhotoPlane('/assets/textures/crimea_sea.jpg', new THREE.Vector3(1, 0.5, -15), new THREE.Euler(0, -0.2, 0), 0.4);

  // Hide DOM images since they are now in 3D space
  document.querySelectorAll('.webgl-sync').forEach(el => el.style.opacity = '0');

  // 3. Vintage Camera GLTF
  return new Promise((resolve) => {
    new GLTFLoader().load('/assets/models/vintage_camera.glb', (gltf) => {
      const camModel = gltf.scene;
      camModel.position.set(2, 1, -25);
      camModel.scale.setScalar(4.0);
      camModel.rotation.y = Math.PI / 4;
      scene.add(camModel);
      
      // Floating animation for camera
      camModel.userData.isCamera = true;
      camModel.userData.baseY = camModel.position.y;
      resolve();
    }, undefined, () => resolve());
  });
}

// --------------------------------------------------------------------------
// DUST & EMBERS (Atmosphere)
// --------------------------------------------------------------------------
function buildDustMotes() {
  dustGeometry = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST_COUNT * 3);
  for (let i = 0; i < DUST_COUNT; i++) {
    dustPos[i * 3 + 0] = (Math.random() - 0.5) * 20.0;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 10.0;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 60.0 + 10.0; // Distribute along the entire Z path
  }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustMaterial = new THREE.ShaderMaterial({
    vertexShader: \`
      uniform float uTime;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.4 + position.y * 2.0) * 0.15;
        p.y += cos(uTime * 0.3 + position.x * 2.0) * 0.15;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = (20.0 / -mvPosition.z);
      }
    \`,
    fragmentShader: \`
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float core = 1.0 - smoothstep(0.0, 0.5, d);
        gl_FragColor = vec4(0.96, 0.88, 0.74, core * 0.4);
      }
    \`,
    uniforms: { uTime: { value: 0.0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  dustMesh = new THREE.Points(dustGeometry, dustMaterial);
  scene.add(dustMesh);
}

function buildEmbers() {
  emberGeometry = new THREE.BufferGeometry();
  const pos = new Float32Array(EMBER_COUNT * 3);
  for(let i=0; i<EMBER_COUNT; i++) {
    pos[i*3] = (Math.random()-0.5)*15;
    pos[i*3+1] = -5 - Math.random()*5;
    pos[i*3+2] = (Math.random()-0.5)*40;
  }
  emberGeometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  emberMaterial = new THREE.ShaderMaterial({
    vertexShader: \`
      uniform float uTime;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y += mod(uTime * 1.0 + p.x, 15.0);
        p.x += sin(uTime * 1.5 + p.y) * 0.5;
        vAlpha = sin(uTime * 2.0 + p.x) * 0.5 + 0.5;
        vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPos;
        gl_PointSize = (12.0 / -mvPos.z);
      }
    \`,
    fragmentShader: \`
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if(d>0.5) discard;
        gl_FragColor = vec4(1.0, 0.6, 0.2, (1.0-d*2.0)*vAlpha);
      }
    \`,
    uniforms: { uTime: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  emberMesh = new THREE.Points(emberGeometry, emberMaterial);
  scene.add(emberMesh);
}

// --------------------------------------------------------------------------
// GSAP SCROLL & LOGIC
// --------------------------------------------------------------------------
function initScrollTrigger() {
  // We use the body scroll to drive the entire journey (0 to 1 progress)
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.5,
    onUpdate: (self) => {
      targetScrollProgress = self.progress;
    }
  });

  // Track velocity for photo distortion
  window.addEventListener('scroll', () => {
    const currentY = window.scrollY;
    scrollVelocity = (currentY - lastScrollY);
    lastScrollY = currentY;
  });
  
  // Section HUD Updates
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

  scrollVelocity *= 0.9; // decay velocity

  // Smooth scroll interpolation
  scrollProgress += (targetScrollProgress - scrollProgress) * 0.05;
  
  // Update Camera Spline Position
  if (cameraCurve) {
    // 0 = start of curve, 1 = end of curve
    // We constrain to 0.001 - 0.999 to avoid curve edge errors
    const p = Math.max(0.001, Math.min(0.999, scrollProgress));
    
    // Get position on curve
    const camPos = cameraCurve.getPointAt(p);
    cameraGroup.position.copy(camPos);
    
    // Look ahead on the curve
    const lookAheadP = Math.min(0.999, p + 0.05);
    const lookAtPos = cameraCurve.getPointAt(lookAheadP);
    cameraGroup.lookAt(lookAtPos);
  }

  // Smooth mouse for parallax
  const targetX = (mouseX / window.innerWidth) * 2 - 1;
  const targetY = -(mouseY / window.innerHeight) * 2 + 1;
  
  camera.position.x += (targetX * 0.5 - camera.position.x) * 0.05;
  camera.position.y += (targetY * 0.5 - camera.position.y) * 0.05;

  if (dustMesh) dustMaterial.uniforms.uTime.value = time;
  if (emberMesh) emberMaterial.uniforms.uTime.value = time;

  // Update Photo Uniforms and Floating Objects
  scene.traverse((child) => {
    if (child.userData.isPhoto && child.material.uniforms) {
      child.material.uniforms.uTime.value = time;
      child.material.uniforms.uVelocity.value = THREE.MathUtils.lerp(
        child.material.uniforms.uVelocity.value,
        scrollVelocity,
        0.1
      );
    }
    if (child.userData.isCamera) {
      child.position.y = child.userData.baseY + Math.sin(time) * 0.2;
      child.rotation.y += 0.002;
    }
  });

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
