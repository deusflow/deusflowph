import * as THREE from 'three';
import { Text } from 'troika-three-text';

const DUST_COUNT = 300;

let scene, camera, renderer;
let clock = new THREE.Clock();

let dustMesh, dustMaterial, dustGeometry;

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
  { title: 'PROLOGUE // THE VOID', timecode: 'FOLIO 01 / 05', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: '01 // THE CRAFT', timecode: 'FOLIO 02 / 05', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: '02 // THE SILHOUETTE', timecode: 'FOLIO 03 / 05', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: '03 // THE MEMORY', timecode: 'FOLIO 04 / 05', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: 'EPILOGUE // THE FRAME', timecode: 'FOLIO 05 / 05', act: 'ACT I // ROOTS & THE FIRST LENS' }
];

document.addEventListener('DOMContentLoaded', async () => {
  initThree();
  buildDustMotes();
  buildDioramaArchitecture();
  buildSplinePath();
  await buildMiseEnScene();
  initScrollTrigger();
  initMouseListener();
  animate();
});

function initThree() {
  const canvas = document.getElementById('webgl-canvas');
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0d0a08, 0.03); // Deep dark oak fog for depth
  
  cameraGroup = new THREE.Group();
  scene.add(cameraGroup);
  
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 150);
  cameraGroup.add(camera);
  
  renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  window.addEventListener('resize', onWindowResize);
}

// --------------------------------------------------------------------------
// PROCEDURAL DIORAMA ARCHITECTURE (The Memory Corridor)
// --------------------------------------------------------------------------
function buildDioramaArchitecture() {
  const archGroup = new THREE.Group();
  scene.add(archGroup);

  // Stylized Baked Shader (Dark Oak to Warm Amber)
  const archMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vPosition;
      varying vec3 vNormal;
      void main() {
        vPosition = position;
        vNormal = normalMatrix * normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPosition;
      varying vec3 vNormal;
      void main() {
        // Base dark oak color
        vec3 darkOak = vec3(0.05, 0.04, 0.03);
        // Warm amber highlight
        vec3 warmAmber = vec3(0.2, 0.1, 0.05);
        
        // Fake ambient occlusion based on height (Y)
        float ao = smoothstep(-2.0, 5.0, vPosition.y);
        
        // Fake rim light from normal
        float rim = max(0.0, dot(vNormal, vec3(0.0, 1.0, 0.5)));
        
        vec3 finalColor = mix(darkOak, warmAmber, ao * 0.5 + rim * 0.5);
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    side: THREE.DoubleSide
  });

  // Floor
  const floorGeo = new THREE.PlaneGeometry(20, 150);
  const floor = new THREE.Mesh(floorGeo, archMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  floor.position.z = -60;
  archGroup.add(floor);

  // Arches
  const archCount = 8;
  const spacing = 15;
  for (let i = 0; i < archCount; i++) {
    const zPos = -i * spacing;

    // Left Pillar
    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 1), archMaterial);
    pillarL.position.set(-4, 2, zPos);
    archGroup.add(pillarL);

    // Right Pillar
    const pillarR = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 1), archMaterial);
    pillarR.position.set(4, 2, zPos);
    archGroup.add(pillarR);

    // Top Arch (Lintel)
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 1), archMaterial);
    lintel.position.set(0, 6.5, zPos);
    archGroup.add(lintel);
  }
}

// --------------------------------------------------------------------------
// SPLINE PATH
// --------------------------------------------------------------------------
function buildSplinePath() {
  cameraCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 2, 10),    // Start before corridor
    new THREE.Vector3(1, 1.5, 0),   // Enter corridor
    new THREE.Vector3(-1, 1.5, -15),// Passing first photo
    new THREE.Vector3(1, 1.5, -30), // Passing second photo
    new THREE.Vector3(-1, 1.5, -45),// Passing third photo
    new THREE.Vector3(0, 2, -65),   // End of corridor
    new THREE.Vector3(0, 2.5, -80)  // Fly out into the void
  ]);
  cameraCurve.tension = 0.6;
}

// --------------------------------------------------------------------------
// MISE EN SCÈNE (Photos & Text)
// --------------------------------------------------------------------------
async function buildMiseEnScene() {
  // 1. 3D Text (Title)
  const myText = new Text();
  myText.text = "DEUSFLOW\nARCHIVE";
  myText.fontSize = 1.0;
  myText.font = "https://fonts.gstatic.com/s/cinzel/v19/8vIJ7qcw3PEtcqCGzCwjI7Lg_xY.woff2";
  myText.position.set(0, 3, 2);
  myText.rotation.y = 0;
  myText.color = 0xffcc88;
  myText.anchorX = 'center';
  myText.anchorY = 'middle';
  scene.add(myText);
  myText.sync();

  // 2. Unsplash Photos as WebGL Planes
  const planeGeo = new THREE.PlaneGeometry(6, 4); 
  
  const createPhotoPlane = (url, pos, rot) => {
    const tex = new THREE.TextureLoader().load(url);
    const mat = new THREE.ShaderMaterial({
      vertexShader: `
        uniform float uTime;
        uniform float uVelocity;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          // Gentle breathing + scroll velocity warp
          p.z += sin(p.y * 3.0 + uTime) * uVelocity * 0.003;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
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
      `,
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
    return mesh;
  };

  createPhotoPlane('/assets/textures/unsplash_film.jpg', new THREE.Vector3(2, 2, -10), new THREE.Euler(0, -0.3, 0));
  createPhotoPlane('/assets/textures/unsplash_silhouette.jpg', new THREE.Vector3(-2, 1.5, -25), new THREE.Euler(0, 0.3, 0));
  createPhotoPlane('/assets/textures/unsplash_memory.jpg', new THREE.Vector3(2, 2.5, -40), new THREE.Euler(0, -0.2, 0));
  createPhotoPlane('/assets/textures/unsplash_frame.jpg', new THREE.Vector3(0, 2, -55), new THREE.Euler(0, 0, 0));

  // Hide DOM images since they are now in 3D space
  document.querySelectorAll('.webgl-sync').forEach(el => el.style.opacity = '0');
}

// --------------------------------------------------------------------------
// DUST ATMOSPHERE
// --------------------------------------------------------------------------
function buildDustMotes() {
  dustGeometry = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST_COUNT * 3);
  for (let i = 0; i < DUST_COUNT; i++) {
    dustPos[i * 3 + 0] = (Math.random() - 0.5) * 15.0;
    dustPos[i * 3 + 1] = Math.random() * 8.0;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 100.0 - 20.0;
  }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      uniform float uTime;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.4 + position.y * 2.0) * 0.15;
        p.y += cos(uTime * 0.3 + position.x * 2.0) * 0.15;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = (25.0 / -mvPosition.z);
      }
    `,
    fragmentShader: `
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float core = 1.0 - smoothstep(0.0, 0.5, d);
        gl_FragColor = vec4(0.96, 0.88, 0.74, core * 0.3);
      }
    `,
    uniforms: { uTime: { value: 0.0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  dustMesh = new THREE.Points(dustGeometry, dustMaterial);
  scene.add(dustMesh);
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
  
  if (cameraCurve) {
    const p = Math.max(0.001, Math.min(0.999, scrollProgress));
    const camPos = cameraCurve.getPointAt(p);
    cameraGroup.position.copy(camPos);
    
    const lookAheadP = Math.min(0.999, p + 0.03);
    const lookAtPos = cameraCurve.getPointAt(lookAheadP);
    cameraGroup.lookAt(lookAtPos);
  }

  const targetX = (mouseX / window.innerWidth) * 2 - 1;
  const targetY = -(mouseY / window.innerHeight) * 2 + 1;
  
  camera.position.x += (targetX * 0.3 - camera.position.x) * 0.05;
  camera.position.y += (targetY * 0.3 - camera.position.y) * 0.05;

  if (dustMesh) dustMaterial.uniforms.uTime.value = time;

  scene.traverse((child) => {
    if (child.userData.isPhoto) {
      child.material.uniforms.uTime.value = time;
      child.material.uniforms.uVelocity.value = THREE.MathUtils.lerp(
        child.material.uniforms.uVelocity.value,
        scrollVelocity,
        0.1
      );
      // Gentle floating
      child.position.y = child.userData.baseY + Math.sin(time + child.position.z) * 0.2;
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
