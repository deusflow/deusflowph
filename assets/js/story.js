/**
 * DEUSFLOW · 3D MORPHING TABLEAU ENGINE (PROLOGUE + ACT 1)
 * Real GLTF Vintage Camera + Poly Haven Studio HDRI + MeshSurfaceSampler + Floating Photo Planes
 * Style Inspired by: meermohsin.me (artistic alchemy) & moto-card.com (tactile luxury)
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

// ==========================================================================
// 1. STATE & GLOBAL VARIABLES
// ==========================================================================
let scene, camera, renderer, pmremGenerator;
let particleMesh, particleMaterial;
let realCameraGroup = null;
let photoPlaneEmbroidery = null;
let photoPlaneCrimea = null;
let lenisInstance = null;
let scrollVelocity = 0.0;
let mouseX = 0, mouseY = 0;
let targetTiltX = 0, targetTiltY = 0;

const isMobile = () => window.innerWidth < 768;
const PARTICLE_COUNT = 9000;

// HUD Elements
const hudTimecode = document.getElementById('hud-timecode');
const hudScrollPct = document.getElementById('hud-scroll-pct');
const hudSceneName = document.getElementById('hud-scene-name');
const hudIso = document.getElementById('hud-iso');
const hudLens = document.getElementById('hud-lens');
const audioToggle = document.getElementById('audio-toggle');
const audioStatus = document.getElementById('audio-status');

// Web Audio
let audioCtx = null;
let isAudioActive = false;
let ambientGain = null;

// ==========================================================================
// 2. INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initThree();
  initLenis();
  initAudio();
  initMouseListener();

  // Load Studio HDRI & 3D Assets
  await loadStudioEnvironment();
  await loadAssetsAndBuildScene();

  initScrollTimeline();
  animate();
});

// ==========================================================================
// 3. THREE.JS FOUNDATION
// ==========================================================================
function initThree() {
  const canvas = document.getElementById('stage-canvas');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060608);

  const fov = isMobile() ? 46 : 40;
  const camZ = isMobile() ? 7.8 : 7.2;

  camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0.1, camZ);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  // Key and rim lighting
  const keyLight = new THREE.DirectionalLight(0xfff5ea, 2.8);
  keyLight.position.set(4, 6, 4);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x8cb0d8, 1.4);
  fillLight.position.set(-4, -1, -3);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0xd4ba95, 3.5, 18);
  rimLight.position.set(0, 4, -2);
  scene.add(rimLight);

  window.addEventListener('resize', onWindowResize);
}

// ==========================================================================
// 4. STUDIO HDRI ENVIRONMENT (Poly Haven Softbox Lighting)
// ==========================================================================
async function loadStudioEnvironment() {
  return new Promise((resolve) => {
    const rgbeLoader = new RGBELoader();
    rgbeLoader.load(
      '/assets/textures/studio_env.hdr',
      (texture) => {
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        scene.environment = envMap;
        texture.dispose();
        resolve();
      },
      undefined,
      (err) => {
        console.warn('HDRI load warning, procedural ambient fallback:', err);
        const ambient = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambient);
        resolve();
      }
    );
  });
}

// ==========================================================================
// 5. ASSET LOADING & MORPHING PARTICLE SYSTEM (MeshSurfaceSampler)
// ==========================================================================
async function loadAssetsAndBuildScene() {
  const mob = isMobile();

  // 1. Build Form A: Silk Embroidery Thread Lattice (Childhood Crafting)
  const posA = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = i / PARTICLE_COUNT;
    const strand = i % 7;
    const phi = t * Math.PI * 16 + strand * 0.9;
    const rad = (mob ? 0.45 : 0.6) + (mob ? 0.7 : 0.95) * Math.sin(t * Math.PI) + 0.15 * Math.sin(strand * 3.0);
    
    const offsetX = mob ? 0.0 : 0.6;
    const offsetY = mob ? -0.8 : 0.1;

    const x = rad * Math.cos(phi) * 1.3 + (Math.sin(strand + t * 5.0) * 0.25) + offsetX;
    const y = (t - 0.5) * (mob ? 2.2 : 3.2) + Math.cos(phi * 0.5) * 0.35 + offsetY;
    const z = rad * Math.sin(phi) * 0.95 + (Math.cos(strand * 2.0) * 0.2);

    posA[i * 3] = x;
    posA[i * 3 + 1] = y;
    posA[i * 3 + 2] = z;
  }

  // 2. Load Real 3D Vintage Camera GLTF & Sample Form B
  const posB = new Float32Array(PARTICLE_COUNT * 3);
  await new Promise((resolve) => {
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      '/assets/models/vintage_camera.glb',
      (gltf) => {
        realCameraGroup = gltf.scene;

        // Auto-scale and center camera
        const box = new THREE.Box3().setFromObject(realCameraGroup);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleVal = mob ? 1.6 : 2.7;
        const scale = scaleVal / maxDim;
        realCameraGroup.scale.setScalar(scale);

        // Center pivot & position on right/lower stage
        box.setFromObject(realCameraGroup);
        const center = box.getCenter(new THREE.Vector3());
        realCameraGroup.position.sub(center);

        if (mob) {
          realCameraGroup.position.x = 0.0;
          realCameraGroup.position.y = -1.35;
        } else {
          realCameraGroup.position.x += 0.85;
          realCameraGroup.position.y += 0.25;
        }

        // Enhance materials with physical luxury
        const sampleMeshes = [];
        realCameraGroup.traverse((child) => {
          if (child.isMesh) {
            sampleMeshes.push(child);
            if (child.material) {
              child.material.transparent = true;
              child.material.opacity = 0.0; // Managed by GSAP
              child.material.envMapIntensity = 1.5;
              child.material.roughness = Math.min(child.material.roughness, 0.38);
            }
          }
        });

        // Sample exact surface points with MeshSurfaceSampler
        if (sampleMeshes.length > 0) {
          let pointsPerMesh = Math.floor(PARTICLE_COUNT / sampleMeshes.length);
          let pointIndex = 0;
          const tempPos = new THREE.Vector3();

          sampleMeshes.forEach((mesh) => {
            try {
              const sampler = new MeshSurfaceSampler(mesh).build();
              for (let i = 0; i < pointsPerMesh && pointIndex < PARTICLE_COUNT; i++) {
                sampler.sample(tempPos);
                mesh.localToWorld(tempPos);
                posB[pointIndex * 3] = tempPos.x;
                posB[pointIndex * 3 + 1] = tempPos.y;
                posB[pointIndex * 3 + 2] = tempPos.z;
                pointIndex++;
              }
            } catch (e) {
              console.warn('Sampler fallback for mesh:', e);
            }
          });

          // Fill remaining points
          while (pointIndex < PARTICLE_COUNT) {
            const fallbackIdx = (pointIndex % sampleMeshes.length);
            const m = sampleMeshes[fallbackIdx];
            const count = m.geometry.attributes.position.count;
            const rnd = Math.floor(Math.random() * count);
            tempPos.fromBufferAttribute(m.geometry.attributes.position, rnd);
            m.localToWorld(tempPos);
            posB[pointIndex * 3] = tempPos.x;
            posB[pointIndex * 3 + 1] = tempPos.y;
            posB[pointIndex * 3 + 2] = tempPos.z;
            pointIndex++;
          }
        }

        scene.add(realCameraGroup);
        resolve();
      },
      undefined,
      (err) => {
        console.warn('GLTF load failed, using procedural camera fallback:', err);
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          posB[i * 3] = (Math.random() - 0.5) * 1.8 + (mob ? 0.0 : 0.85);
          posB[i * 3 + 1] = (Math.random() - 0.5) * 1.3 + (mob ? -1.35 : 0.25);
          posB[i * 3 + 2] = (Math.random() - 0.5) * 1.0;
        }
        resolve();
      }
    );
  });

  // 3. Create Custom Morphing Particle Geometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(posA, 3));
  geometry.setAttribute('aTarget', new THREE.BufferAttribute(posB, 3));

  const randoms = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
    randoms[i] = (Math.random() - 0.5) * 2.0;
  }
  geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3));

  // 4. Custom GLSL Shader
  const vShader = [
    'uniform float uProgress;',
    'uniform float uVelocity;',
    'uniform float uTime;',
    'uniform float uPixelRatio;',
    'attribute vec3 aTarget;',
    'attribute vec3 aRandom;',
    'varying vec3 vPosition;',
    'varying float vMorph;',
    'varying float vDist;',
    'vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }',
    'vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }',
    'vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }',
    'vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }',
    'float snoise(vec3 v) {',
    '  const vec2 C = vec2(1.0/6.0, 1.0/3.0);',
    '  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);',
    '  vec3 i  = floor(v + dot(v, C.yyy));',
    '  vec3 x0 = v - i + dot(i, C.xxx);',
    '  vec3 g = step(x0.yzx, x0.xyz);',
    '  vec3 l = 1.0 - g;',
    '  vec3 i1 = min(g.xyz, l.zxy);',
    '  vec3 i2 = max(g.xyz, l.zxy);',
    '  vec3 x1 = x0 - i1 + C.xxx;',
    '  vec3 x2 = x0 - i2 + C.yyy;',
    '  vec3 x3 = x0 - D.yyy;',
    '  i = mod289(i);',
    '  vec4 p = permute(permute(permute(',
    '            i.z + vec4(0.0, i1.z, i2.z, 1.0))',
    '          + i.y + vec4(0.0, i1.y, i2.y, 1.0))',
    '          + i.x + vec4(0.0, i1.x, i2.x, 1.0));',
    '  float n_ = 0.142857142857;',
    '  vec3  ns = n_ * D.wyz - D.xzx;',
    '  vec4 j = p - 49.0 * floor(p * ns.z);',
    '  vec4 x_ = floor(j * ns.z);',
    '  vec4 y_ = floor(j - 7.0 * x_);',
    '  vec4 x = x_ *ns.x + ns.yyyy;',
    '  vec4 y = y_ *ns.x + ns.yyyy;',
    '  vec4 h = 1.0 - abs(x) - abs(y);',
    '  vec4 b0 = vec4(x.xy, y.xy);',
    '  vec4 b1 = vec4(x.zw, y.zw);',
    '  vec4 s0 = floor(b0)*2.0 + 1.0;',
    '  vec4 s1 = floor(b1)*2.0 + 1.0;',
    '  vec4 sh = -step(h, vec4(0.0));',
    '  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;',
    '  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;',
    '  vec3 p0 = vec3(a0.xy, h.x);',
    '  vec3 p1 = vec3(a0.zw, h.y);',
    '  vec3 p2 = vec3(a1.xy, h.z);',
    '  vec3 p3 = vec3(a1.zw, h.w);',
    '  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));',
    '  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;',
    '  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);',
    '  m = m * m;',
    '  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));',
    '}',
    'void main() {',
    '  vMorph = uProgress;',
    '  vec3 basePos = mix(position, aTarget, smoothstep(0.0, 1.0, uProgress));',
    '  float morphArch = sin(uProgress * 3.14159265);',
    '  float burstPower = morphArch * 1.6 + clamp(uVelocity * 0.45, 0.0, 1.5);',
    '  vec3 noiseVec = vec3(',
    '    snoise(basePos * 1.2 + vec3(uTime * 0.4, 0.0, 0.0)),',
    '    snoise(basePos * 1.2 + vec3(0.0, uTime * 0.4, 0.0)),',
    '    snoise(basePos * 1.2 + vec3(0.0, 0.0, uTime * 0.4))',
    '  );',
    '  vec3 morphedPos = basePos + (aRandom * 0.85 + noiseVec * 1.1) * burstPower;',
    '  morphedPos.y += sin(uTime * 1.5 + morphedPos.x * 2.0) * 0.04;',
    '  vPosition = morphedPos;',
    '  vec4 mvPosition = modelViewMatrix * vec4(morphedPos, 1.0);',
    '  gl_Position = projectionMatrix * mvPosition;',
    '  float distToCam = -mvPosition.z;',
    '  vDist = distToCam;',
    '  float baseSize = mix(28.0, 18.0, uProgress);',
    '  gl_PointSize = (baseSize / distToCam) * (1.0 + burstPower * 0.5) * uPixelRatio;',
    '}'
  ].join('\n');

  const fShader = [
    'uniform vec3 uColorA;',
    'uniform vec3 uColorB;',
    'uniform vec3 uColorDust;',
    'uniform float uProgress;',
    'uniform float uAlpha;',
    'varying vec3 vPosition;',
    'varying float vMorph;',
    'varying float vDist;',
    'void main() {',
    '  vec2 coord = gl_PointCoord - vec2(0.5);',
    '  float r = length(coord);',
    '  if (r > 0.5) discard;',
    '  float circleAlpha = smoothstep(0.5, 0.08, r);',
    '  float midFactor = sin(uProgress * 3.14159265);',
    '  vec3 currentCol = mix(uColorA, uColorB, uProgress);',
    '  currentCol = mix(currentCol, uColorDust, midFactor * 0.85);',
    '  float depthAlpha = clamp(1.0 - (vDist - 4.5) * 0.18, 0.2, 1.0);',
    '  float core = smoothstep(0.2, 0.0, r) * 0.4;',
    '  gl_FragColor = vec4(currentCol + vec3(core), circleAlpha * depthAlpha * uAlpha);',
    '}'
  ].join('\n');

  particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uProgress: { value: 0.0 },
      uVelocity: { value: 0.0 },
      uTime: { value: 0.0 },
      uColorA: { value: new THREE.Color(0xe6c594) }, // Silk Gold
      uColorB: { value: new THREE.Color(0xf5ede0) }, // Vintage Camera Chrome
      uColorDust: { value: new THREE.Color(0xd49b4b) }, // Alchemy Ember
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uAlpha: { value: 1.0 }
    },
    vertexShader: vShader,
    fragmentShader: fShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  particleMesh = new THREE.Points(geometry, particleMaterial);
  scene.add(particleMesh);

  // 5. Floating Archival 3D Photo Memory Planes
  buildPhotoPlanes();
}

// ==========================================================================
// 6. FLOATING 3D PHOTO MEMORY PLANES (Archival Visual Flesh)
// ==========================================================================
function buildPhotoPlanes() {
  const textureLoader = new THREE.TextureLoader();
  const mob = isMobile();

  // Photo 1: Childhood Embroidery Craftwork
  const texEmbroidery = textureLoader.load('/assets/textures/embroidery_threads.jpg');
  texEmbroidery.colorSpace = THREE.SRGBColorSpace;

  const photoGeo = new THREE.PlaneGeometry(mob ? 1.1 : 1.6, mob ? 0.75 : 1.1, 16, 16);
  const photoMat1 = new THREE.MeshStandardMaterial({
    map: texEmbroidery,
    roughness: 0.35,
    metalness: 0.1,
    transparent: true,
    opacity: 0.0 // Managed by GSAP
  });
  
  photoPlaneEmbroidery = new THREE.Group();
  const mesh1 = new THREE.Mesh(photoGeo, photoMat1);
  photoPlaneEmbroidery.add(mesh1);

  // Sleek glass frame bezel
  const frameGeo = new THREE.BoxGeometry(mob ? 1.16 : 1.68, mob ? 0.81 : 1.18, 0.04);
  const frameMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a1a20,
    metalness: 0.8,
    roughness: 0.2,
    transparent: true,
    opacity: 0.0
  });
  const frame1 = new THREE.Mesh(frameGeo, frameMat);
  frame1.position.z = -0.025;
  photoPlaneEmbroidery.add(frame1);

  if (mob) {
    photoPlaneEmbroidery.position.set(0.0, -1.1, 0.4);
    photoPlaneEmbroidery.rotation.set(0.06, -0.10, 0.02);
  } else {
    photoPlaneEmbroidery.position.set(2.4, 0.35, 0.5);
    photoPlaneEmbroidery.rotation.set(0.08, -0.26, 0.05);
  }
  scene.add(photoPlaneEmbroidery);

  // Photo 2: Crimea Sea Memories (35mm Film)
  const texCrimea = textureLoader.load('/assets/textures/crimea_sea.jpg');
  texCrimea.colorSpace = THREE.SRGBColorSpace;

  const photoMat2 = new THREE.MeshStandardMaterial({
    map: texCrimea,
    roughness: 0.35,
    metalness: 0.1,
    transparent: true,
    opacity: 0.0
  });

  photoPlaneCrimea = new THREE.Group();
  const mesh2 = new THREE.Mesh(photoGeo, photoMat2);
  photoPlaneCrimea.add(mesh2);

  const frame2 = new THREE.Mesh(frameGeo, frameMat.clone());
  frame2.position.z = -0.025;
  photoPlaneCrimea.add(frame2);

  if (mob) {
    photoPlaneCrimea.position.set(0.0, -2.1, 0.5);
    photoPlaneCrimea.rotation.set(-0.04, -0.05, 0.01);
  } else {
    photoPlaneCrimea.position.set(2.6, -0.45, 0.8);
    photoPlaneCrimea.rotation.set(-0.06, -0.24, 0.04);
  }
  scene.add(photoPlaneCrimea);
}

function setGroupOpacity(group, opacity) {
  if (!group) return;
  group.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.opacity = opacity;
    }
  });
}

// ==========================================================================
// 7. GSAP SCROLLTRIGGER TIMELINE (Master Morphing Orchestration)
// ==========================================================================
function initScrollTimeline() {
  if (!window.gsap || !window.ScrollTrigger) return;

  const beat0 = document.getElementById('beat-0');
  const beat1 = document.getElementById('beat-1');
  const beat2 = document.getElementById('beat-2');

  const tl = window.gsap.timeline({
    scrollTrigger: {
      trigger: '#scroll-track',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.2,
      onUpdate: (self) => {
        const p = self.progress;
        
        // HUD Updates
        if (hudScrollPct) hudScrollPct.textContent = Math.round(p * 100).toString().padStart(2, '0') + '%';

        if (p < 0.28) {
          if (hudSceneName) hudSceneName.textContent = '00 // THE PROLOGUE';
          if (hudIso) hudIso.textContent = 'ISO 3200';
          if (hudLens) hudLens.textContent = '35mm f/1.4';
        } else if (p < 0.68) {
          if (hudSceneName) hudSceneName.textContent = '01 // CRAFT & EMBROIDERY';
          if (hudIso) hudIso.textContent = 'ISO 1600';
          if (hudLens) hudLens.textContent = '35mm f/2.0';
        } else {
          if (hudSceneName) hudSceneName.textContent = '02 // THE FIRST LENS · 35MM';
          if (hudIso) hudIso.textContent = 'ISO 800';
          if (hudLens) hudLens.textContent = '35mm FILM';
        }

        // Real 3D Camera GLTF Materialization Ramp
        if (realCameraGroup) {
          if (p > 0.68) {
            const camAlpha = Math.min((p - 0.68) / 0.16, 1.0);
            setGroupOpacity(realCameraGroup, camAlpha);
            if (particleMaterial) {
              particleMaterial.uniforms.uAlpha.value = 1.0 - camAlpha * 0.65;
            }
          } else {
            setGroupOpacity(realCameraGroup, 0.0);
            if (particleMaterial) {
              particleMaterial.uniforms.uAlpha.value = 1.0;
            }
          }
        }

        // Photo Planes Visibility Ramps
        if (photoPlaneEmbroidery) {
          if (p > 0.25 && p < 0.65) {
            const alpha = p < 0.38 ? (p - 0.25) / 0.10 : (0.65 - p) / 0.10;
            setGroupOpacity(photoPlaneEmbroidery, Math.min(Math.max(alpha, 0.0), 1.0));
          } else {
            setGroupOpacity(photoPlaneEmbroidery, 0.0);
          }
        }

        if (photoPlaneCrimea) {
          if (p > 0.68) {
            const alpha = Math.min((p - 0.68) / 0.14, 1.0);
            setGroupOpacity(photoPlaneCrimea, alpha);
          } else {
            setGroupOpacity(photoPlaneCrimea, 0.0);
          }
        }
      }
    }
  });

  // 1. Particle Morph Progress Scrubbing (0.0 -> 1.0)
  if (particleMaterial) {
    tl.to(particleMaterial.uniforms.uProgress, {
      value: 1.0,
      ease: 'none',
      duration: 1.0
    }, 0);
  }

  // 2. Camera Macro Movement
  tl.to(camera.position, {
    z: isMobile() ? 7.4 : 6.8,
    y: isMobile() ? 0.0 : 0.15,
    ease: 'power2.inOut',
    duration: 0.35
  }, 0.65);

  // 3. Beat 0 (Prologue Hook): Visible on load, fades out 0.16 -> 0.26
  tl.to(beat0, 
    { opacity: 0, y: -30, scale: 1.02, duration: 0.10, ease: 'power2.in' }, 
    0.16
  );

  // 4. Beat 1 (Childhood Crafting & Weaving): In at 0.28, stays through 0.60, out at 0.66
  tl.fromTo(beat1, 
    { opacity: 0, y: 30, scale: 0.96 }, 
    { opacity: 1, y: 0, scale: 1.0, duration: 0.10, ease: 'power2.out' }, 
    0.28
  );
  tl.to(beat1, 
    { opacity: 0, y: -25, scale: 1.02, duration: 0.08, ease: 'power2.in' }, 
    0.60
  );

  // 5. Beat 2 (Olympus Camera & Crimea): In at 0.68 -> 1.00
  tl.fromTo(beat2, 
    { opacity: 0, y: 35, scale: 0.96 }, 
    { opacity: 1, y: 0, scale: 1.0, duration: 0.14, ease: 'power2.out' }, 
    0.68
  );
}

// ==========================================================================
// 8. LENIS SMOOTH SCROLL & VELOCITY TRACKING
// ==========================================================================
function initLenis() {
  if (typeof window.Lenis === 'undefined') return;

  lenisInstance = new window.Lenis({
    duration: 1.4,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    wheelMultiplier: 0.85
  });

  lenisInstance.on('scroll', (e) => {
    scrollVelocity = Math.abs(e.velocity || 0) * 0.18;
    if (window.ScrollTrigger) window.ScrollTrigger.update();
  });

  function raf(time) {
    lenisInstance.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}

// ==========================================================================
// 9. MOUSE PARALLAX & TACTILE MACRO TILT (moto-card.com feel)
// ==========================================================================
function initMouseListener() {
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    targetTiltX = mouseY * 0.22;
    targetTiltY = mouseX * 0.35;
  });
}

// ==========================================================================
// 10. WEB AUDIO SYNTHESIZER (Analog Shutter & Vinyl Warmth)
// ==========================================================================
function initAudio() {
  if (!audioToggle) return;

  audioToggle.addEventListener('click', () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      setupAmbientTapeNoise();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    isAudioActive = !isAudioActive;
    if (isAudioActive) {
      ambientGain.gain.setTargetAtTime(0.04, audioCtx.currentTime, 0.2);
      audioStatus.textContent = 'SOUND: ON';
      playCameraShutterSound();
    } else {
      ambientGain.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.2);
      audioStatus.textContent = 'SOUND: OFF';
    }
  });
}

function setupAmbientTapeNoise() {
  const bufferSize = audioCtx.sampleRate * 2;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }

  const whiteNoise = audioCtx.createBufferSource();
  whiteNoise.buffer = noiseBuffer;
  whiteNoise.loop = true;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 650;

  ambientGain = audioCtx.createGain();
  ambientGain.gain.value = 0.0;

  whiteNoise.connect(filter);
  filter.connect(ambientGain);
  ambientGain.connect(audioCtx.destination);
  whiteNoise.start();
}

function playCameraShutterSound() {
  if (!audioCtx || !isAudioActive) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(140, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.09);
}

// ==========================================================================
// 11. MAIN ANIMATION LOOP
// ==========================================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsedTime = clock.getElapsedTime();

  // 1. Decay scroll velocity
  scrollVelocity *= 0.92;
  if (particleMaterial) {
    particleMaterial.uniforms.uVelocity.value = scrollVelocity;
    particleMaterial.uniforms.uTime.value = elapsedTime;
  }

  // 2. Smooth Tactile Mouse Tilt (moto-card feel)
  if (particleMesh) {
    particleMesh.rotation.y += (targetTiltY - particleMesh.rotation.y) * 0.05;
    particleMesh.rotation.x += (targetTiltX - particleMesh.rotation.x) * 0.05;
  }

  if (realCameraGroup) {
    realCameraGroup.rotation.y += (targetTiltY + 0.25 - realCameraGroup.rotation.y) * 0.06;
    realCameraGroup.rotation.x += (targetTiltX + 0.05 - realCameraGroup.rotation.x) * 0.06;
  }

  // Floating Photo Planes levitation
  if (photoPlaneEmbroidery) {
    const basePosY = isMobile() ? -1.1 : 0.35;
    photoPlaneEmbroidery.position.y = basePosY + Math.sin(elapsedTime * 1.2) * 0.04;
    photoPlaneEmbroidery.rotation.y = (isMobile() ? -0.10 : -0.26) + targetTiltY * 0.4;
  }
  if (photoPlaneCrimea) {
    const basePosY = isMobile() ? -2.1 : -0.45;
    photoPlaneCrimea.position.y = basePosY + Math.cos(elapsedTime * 1.4) * 0.04;
    photoPlaneCrimea.rotation.y = (isMobile() ? -0.05 : -0.24) + targetTiltY * 0.4;
  }

  // 3. Timecode HUD Clock
  const secs = Math.floor(elapsedTime);
  const mins = Math.floor(secs / 60);
  if (hudTimecode) {
    hudTimecode.textContent = 'REC 00:' + mins.toString().padStart(2, '0') + ':' + (secs % 60).toString().padStart(2, '0');
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (particleMaterial) {
    particleMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  }
}
