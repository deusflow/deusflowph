/**
 * DEUSFLOW · LIVING 3D PARTICLE METAMORPHOSIS ENGINE
 * Words & Objects born from the same stardust matter.
 * 
 * 4-Stage Alchemical Cycle:
 * [Stage 0: 0.00-0.18] Stardust Typography: "ПРИСТЕБНІТЬ РЕМЕНІ" + Lead 0
 *   ➔ [Stage 1: 0.22-0.44] Golden Silk Loom + Embroidery Photo Plane + Lead 1
 *   ➔ [Stage 2: 0.48-0.68] Stardust Typography: "УРОКИ ПРАЦІ" + Lead 1 Continuation
 *   ➔ [Stage 3: 0.72-1.00] 3D Olympus Camera (PBR) + Crimea Photo Plane + Lead 2
 *
 * Style: meermohsin.me (alchemical poetry) + moto-card.com (tactile luxury) + Harry Potter stardust magic.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

// ==========================================================================
// 1. GLOBAL STATE
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
const PARTICLE_COUNT = 12000;

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

  if (document.fonts) {
    await document.fonts.ready;
  }

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
  scene.background = new THREE.Color(0x050507);

  const fov = isMobile() ? 48 : 38;
  const camZ = isMobile() ? 7.8 : 7.0;

  camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, camZ);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;

  pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  // Cinematic Key & Rim Lighting
  const keyLight = new THREE.DirectionalLight(0xfff3e0, 3.2);
  keyLight.position.set(4, 6, 4);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x8cb0d8, 1.6);
  fillLight.position.set(-4, -1, -3);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0xd4ba95, 4.0, 18);
  rimLight.position.set(0, 4, -2);
  scene.add(rimLight);

  window.addEventListener('resize', onWindowResize);
}

// ==========================================================================
// 4. STUDIO HDRI ENVIRONMENT
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
        console.warn('HDRI fallback:', err);
        const ambient = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambient);
        resolve();
      }
    );
  });
}

// ==========================================================================
// 5. HIGH-DPI CYRILLIC TEXT PARTICLE SAMPLER
// ==========================================================================
function sampleTextToParticles(lines, options = {}) {
  const {
    fontSize = 110,
    fontFamily = '"Playfair Display", Georgia, serif',
    fontWeight = '700',
    targetWidth = 3.8,
    targetHeight = 1.3,
    offsetX = 0.0,
    offsetY = 0.0,
    particleCount = PARTICLE_COUNT
  } = options;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  const w = 1600;
  const h = 600;
  canvas.width = w;
  canvas.height = h;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#ffffff';
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lineHeight = fontSize * 1.18;
  const startY = (h / 2) - ((lines.length - 1) * lineHeight / 2);

  lines.forEach((line, idx) => {
    ctx.fillText(line, w / 2, startY + idx * lineHeight);
  });

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const whitePixels = [];
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const idx = (y * w + x) * 4;
      if (data[idx] > 100) {
        whitePixels.push({
          x: (x / w - 0.5) * targetWidth + offsetX,
          y: (0.5 - y / h) * targetHeight + offsetY
        });
      }
    }
  }

  const positions = new Float32Array(particleCount * 3);
  if (whitePixels.length === 0) {
    for (let i = 0; i < particleCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 2.0;
    }
    return positions;
  }

  for (let i = 0; i < particleCount; i++) {
    const p = whitePixels[Math.floor(Math.random() * whitePixels.length)];
    positions[i * 3] = p.x + (Math.random() - 0.5) * 0.016;
    positions[i * 3 + 1] = p.y + (Math.random() - 0.5) * 0.016;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.12; // 3D letter depth
  }

  return positions;
}

// ==========================================================================
// 6. ASSET LOADING & 4-STAGE ALCHEMICAL MORPHING PIPELINE
// ==========================================================================
async function loadAssetsAndBuildScene() {
  const mob = isMobile();

  // STAGE 0: Headline Typography "ПРИСТЕБНІТЬ РЕМЕНІ"
  const posStage0 = sampleTextToParticles(
    mob ? ['ПРИСТЕБНІТЬ', 'РЕМЕНІ'] : ['ПРИСТЕБНІТЬ РЕМЕНІ'],
    {
      fontSize: mob ? 95 : 120,
      targetWidth: mob ? 3.0 : 4.4,
      targetHeight: mob ? 1.4 : 1.1,
      offsetX: mob ? 0.0 : 0.0,
      offsetY: mob ? 0.40 : 0.45,
      particleCount: PARTICLE_COUNT
    }
  );

  // STAGE 1: Golden Silk Loom (Interwoven Helical Strands)
  const posStage1 = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = i / PARTICLE_COUNT;
    const strand = i % 7;
    const phi = t * Math.PI * 18 + strand * 0.9;
    const rad = (mob ? 0.5 : 0.65) + (mob ? 0.7 : 0.9) * Math.sin(t * Math.PI) + 0.12 * Math.sin(strand * 3.0);
    
    const offsetX = mob ? 0.0 : 0.7;
    const offsetY = mob ? -0.4 : 0.1;

    posStage1[i * 3] = rad * Math.cos(phi) * 1.35 + (Math.sin(strand + t * 5.0) * 0.2) + offsetX;
    posStage1[i * 3 + 1] = (t - 0.5) * (mob ? 2.5 : 3.2) + Math.cos(phi * 0.5) * 0.35 + offsetY;
    posStage1[i * 3 + 2] = rad * Math.sin(phi) * 0.95 + (Math.cos(strand * 2.0) * 0.18);
  }

  // STAGE 2: Headline Typography "УРОКИ ПРАЦІ"
  const posStage2 = sampleTextToParticles(
    mob ? ['УРОКИ', 'ПРАЦІ'] : ['УРОКИ ПРАЦІ'],
    {
      fontSize: mob ? 100 : 135,
      targetWidth: mob ? 2.8 : 4.0,
      targetHeight: mob ? 1.4 : 1.1,
      offsetX: mob ? 0.0 : 0.0,
      offsetY: mob ? 0.40 : 0.45,
      particleCount: PARTICLE_COUNT
    }
  );

  // STAGE 3: Real 3D Vintage Camera GLTF Surface Points
  const posStage3 = new Float32Array(PARTICLE_COUNT * 3);
  await new Promise((resolve) => {
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      '/assets/models/vintage_camera.glb',
      (gltf) => {
        realCameraGroup = gltf.scene;

        const box = new THREE.Box3().setFromObject(realCameraGroup);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleVal = mob ? 1.7 : 2.7;
        const scale = scaleVal / maxDim;
        realCameraGroup.scale.setScalar(scale);

        box.setFromObject(realCameraGroup);
        const center = box.getCenter(new THREE.Vector3());
        realCameraGroup.position.sub(center);

        if (mob) {
          realCameraGroup.position.x = 0.0;
          realCameraGroup.position.y = -1.15;
        } else {
          realCameraGroup.position.x += 0.85;
          realCameraGroup.position.y += 0.25;
        }

        const sampleMeshes = [];
        realCameraGroup.traverse((child) => {
          if (child.isMesh) {
            sampleMeshes.push(child);
            if (child.material) {
              child.material.transparent = true;
              child.material.opacity = 0.0;
              child.material.envMapIntensity = 1.6;
              child.material.roughness = Math.min(child.material.roughness, 0.35);
            }
          }
        });

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
                posStage3[pointIndex * 3] = tempPos.x;
                posStage3[pointIndex * 3 + 1] = tempPos.y;
                posStage3[pointIndex * 3 + 2] = tempPos.z;
                pointIndex++;
              }
            } catch (e) {
              console.warn('Sampler fallback for mesh:', e);
            }
          });

          while (pointIndex < PARTICLE_COUNT) {
            const fallbackIdx = (pointIndex % sampleMeshes.length);
            const m = sampleMeshes[fallbackIdx];
            const count = m.geometry.attributes.position.count;
            const rnd = Math.floor(Math.random() * count);
            tempPos.fromBufferAttribute(m.geometry.attributes.position, rnd);
            m.localToWorld(tempPos);
            posStage3[pointIndex * 3] = tempPos.x;
            posStage3[pointIndex * 3 + 1] = tempPos.y;
            posStage3[pointIndex * 3 + 2] = tempPos.z;
            pointIndex++;
          }
        }

        scene.add(realCameraGroup);
        resolve();
      },
      undefined,
      (err) => {
        console.warn('GLTF load fallback:', err);
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          posStage3[i * 3] = (Math.random() - 0.5) * 1.8 + (mob ? 0.0 : 0.85);
          posStage3[i * 3 + 1] = (Math.random() - 0.5) * 1.3 + (mob ? -1.15 : 0.25);
          posStage3[i * 3 + 2] = (Math.random() - 0.5) * 1.0;
        }
        resolve();
      }
    );
  });

  // BufferGeometry with 4 alchemical morph targets
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(posStage0, 3));
  geometry.setAttribute('aTarget1', new THREE.BufferAttribute(posStage1, 3));
  geometry.setAttribute('aTarget2', new THREE.BufferAttribute(posStage2, 3));
  geometry.setAttribute('aTarget3', new THREE.BufferAttribute(posStage3, 3));

  const randoms = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
    randoms[i] = (Math.random() - 0.5) * 2.0;
  }
  geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3));

  // GLSL Multi-Stage Morphing Shader with Simplex Curl Noise
  const vShader = [
    'uniform float uScrollProgress;',
    'uniform float uVelocity;',
    'uniform float uTime;',
    'uniform float uPixelRatio;',
    'attribute vec3 aTarget1;',
    'attribute vec3 aTarget2;',
    'attribute vec3 aTarget3;',
    'attribute vec3 aRandom;',
    'varying vec3 vPosition;',
    'varying float vDist;',
    'varying float vStageProgress;',
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
    '  float p = uScrollProgress;',
    '  vec3 basePos = position;',
    '  float burstArch = 0.0;',
    '  ',
    '  if (p < 0.333) {',
    '    float localP = smoothstep(0.08, 0.25, p);',
    '    basePos = mix(position, aTarget1, localP);',
    '    burstArch = sin(localP * 3.14159265);',
    '  } else if (p < 0.666) {',
    '    float localP = smoothstep(0.40, 0.55, p);',
    '    basePos = mix(aTarget1, aTarget2, localP);',
    '    burstArch = sin(localP * 3.14159265);',
    '  } else {',
    '    float localP = smoothstep(0.70, 0.88, p);',
    '    basePos = mix(aTarget2, aTarget3, localP);',
    '    burstArch = sin(localP * 3.14159265);',
    '  }',
    '  ',
    '  float burstPower = burstArch * 1.8 + clamp(uVelocity * 0.55, 0.0, 1.8);',
    '  vec3 noiseVec = vec3(',
    '    snoise(basePos * 1.3 + vec3(uTime * 0.45, 0.0, 0.0)),',
    '    snoise(basePos * 1.3 + vec3(0.0, uTime * 0.45, 0.0)),',
    '    snoise(basePos * 1.3 + vec3(0.0, 0.0, uTime * 0.45))',
    '  );',
    '  ',
    '  vec3 morphedPos = basePos + (aRandom * 0.95 + noiseVec * 1.25) * burstPower;',
    '  morphedPos.y += sin(uTime * 1.6 + morphedPos.x * 2.2) * 0.035;',
    '  vPosition = morphedPos;',
    '  ',
    '  vec4 mvPosition = modelViewMatrix * vec4(morphedPos, 1.0);',
    '  gl_Position = projectionMatrix * mvPosition;',
    '  ',
    '  float distToCam = -mvPosition.z;',
    '  vDist = distToCam;',
    '  float baseSize = mix(24.0, 16.0, p);',
    '  gl_PointSize = (baseSize / distToCam) * (1.0 + burstPower * 0.65) * uPixelRatio;',
    '}'
  ].join('\n');

  const fShader = [
    'uniform float uScrollProgress;',
    'uniform float uAlpha;',
    'uniform vec3 uColorGold;',
    'uniform vec3 uColorAmber;',
    'uniform vec3 uColorSilver;',
    'varying vec3 vPosition;',
    'varying float vDist;',
    'void main() {',
    '  vec2 coord = gl_PointCoord - vec2(0.5);',
    '  float r = length(coord);',
    '  if (r > 0.5) discard;',
    '  ',
    '  float circleAlpha = smoothstep(0.5, 0.06, r);',
    '  ',
    '  vec3 currentCol = uColorGold;',
    '  if (uScrollProgress < 0.5) {',
    '    currentCol = mix(uColorGold, uColorAmber, sin(uScrollProgress * 3.14159265));',
    '  } else {',
    '    currentCol = mix(uColorGold, uColorSilver, (uScrollProgress - 0.5) * 2.0);',
    '  }',
    '  ',
    '  float depthAlpha = clamp(1.0 - (vDist - 4.5) * 0.16, 0.25, 1.0);',
    '  float core = smoothstep(0.18, 0.0, r) * 0.55;',
    '  ',
    '  gl_FragColor = vec4(currentCol + vec3(core), circleAlpha * depthAlpha * uAlpha);',
    '}'
  ].join('\n');

  particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uScrollProgress: { value: 0.0 },
      uVelocity: { value: 0.0 },
      uTime: { value: 0.0 },
      uColorGold: { value: new THREE.Color(0xf5e6cb) },
      uColorAmber: { value: new THREE.Color(0xd49b4b) },
      uColorSilver: { value: new THREE.Color(0xffffff) },
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

  buildPhotoPlanes();
}

// ==========================================================================
// 7. FLOATING 3D PHOTO MEMORY PLANES
// ==========================================================================
function buildPhotoPlanes() {
  const textureLoader = new THREE.TextureLoader();
  const mob = isMobile();

  // Photo 1: Childhood Embroidery Craftwork
  const texEmbroidery = textureLoader.load('/assets/textures/embroidery_threads.jpg');
  texEmbroidery.colorSpace = THREE.SRGBColorSpace;

  const photoGeo = new THREE.PlaneGeometry(mob ? 1.15 : 1.6, mob ? 0.8 : 1.1, 16, 16);
  const photoMat1 = new THREE.MeshStandardMaterial({
    map: texEmbroidery,
    roughness: 0.35,
    metalness: 0.1,
    transparent: true,
    opacity: 0.0
  });
  
  photoPlaneEmbroidery = new THREE.Group();
  const mesh1 = new THREE.Mesh(photoGeo, photoMat1);
  photoPlaneEmbroidery.add(mesh1);

  const frameGeo = new THREE.BoxGeometry(mob ? 1.21 : 1.68, mob ? 0.86 : 1.18, 0.04);
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
    photoPlaneEmbroidery.position.set(0.0, -1.15, 0.4);
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
// 8. GSAP SCROLLTRIGGER TIMELINE
// ==========================================================================
function initScrollTimeline() {
  if (!window.gsap || !window.ScrollTrigger) return;

  const lead0 = document.getElementById('lead-0');
  const lead1 = document.getElementById('lead-1');
  const lead2 = document.getElementById('lead-2');

  const tl = window.gsap.timeline({
    scrollTrigger: {
      trigger: '#scroll-track',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.2,
      onUpdate: (self) => {
        const p = self.progress;
        
        if (particleMaterial) {
          particleMaterial.uniforms.uScrollProgress.value = p;
        }

        // HUD Updates
        if (hudScrollPct) hudScrollPct.textContent = Math.round(p * 100).toString().padStart(2, '0') + '%';

        if (p < 0.25) {
          if (hudSceneName) hudSceneName.textContent = '00 // THE PROLOGUE';
          if (hudIso) hudIso.textContent = 'ISO 3200';
          if (hudLens) hudLens.textContent = '35mm f/1.4';
        } else if (p < 0.70) {
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
          if (p > 0.72) {
            const camAlpha = Math.min((p - 0.72) / 0.16, 1.0);
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
          if (p > 0.20 && p < 0.46) {
            const alpha = p < 0.30 ? (p - 0.20) / 0.10 : (0.46 - p) / 0.10;
            setGroupOpacity(photoPlaneEmbroidery, Math.min(Math.max(alpha, 0.0), 1.0));
          } else {
            setGroupOpacity(photoPlaneEmbroidery, 0.0);
          }
        }

        if (photoPlaneCrimea) {
          if (p > 0.70) {
            const alpha = Math.min((p - 0.70) / 0.14, 1.0);
            setGroupOpacity(photoPlaneCrimea, alpha);
          } else {
            setGroupOpacity(photoPlaneCrimea, 0.0);
          }
        }
      }
    }
  });

  // Camera Macro Movement
  tl.to(camera.position, {
    z: isMobile() ? 7.4 : 6.8,
    y: isMobile() ? 0.0 : 0.15,
    ease: 'power2.inOut',
    duration: 0.35
  }, 0.68);

  // Synchronized DOM Lead Narrative Subtitles
  // Beat 0 Lead: Visible at start, fades out 0.10 -> 0.18
  tl.to(lead0, 
    { opacity: 0, y: -20, duration: 0.08, ease: 'power2.in' }, 
    0.10
  );

  // Beat 1 Lead (Childhood Crafting): In at 0.22, stays through 0.62, out at 0.68
  tl.fromTo(lead1, 
    { opacity: 0, y: 25 }, 
    { opacity: 1, y: 0, duration: 0.08, ease: 'power2.out' }, 
    0.22
  );
  tl.to(lead1, 
    { opacity: 0, y: -20, duration: 0.06, ease: 'power2.in' }, 
    0.62
  );

  // Beat 2 Lead (Olympus Camera & Crimea): In at 0.72 -> 1.00
  tl.fromTo(lead2, 
    { opacity: 0, y: 25 }, 
    { opacity: 1, y: 0, duration: 0.12, ease: 'power2.out' }, 
    0.72
  );
}

// ==========================================================================
// 9. LENIS SMOOTH SCROLL & VELOCITY TRACKING
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
    scrollVelocity = Math.abs(e.velocity || 0) * 0.22;
    if (window.ScrollTrigger) window.ScrollTrigger.update();
  });

  function raf(time) {
    lenisInstance.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}

// ==========================================================================
// 10. MOUSE PARALLAX & TACTILE MACRO TILT
// ==========================================================================
function initMouseListener() {
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    targetTiltX = mouseY * 0.18;
    targetTiltY = mouseX * 0.28;
  });
}

// ==========================================================================
// 11. WEB AUDIO SYNTHESIZER
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
// 12. MAIN ANIMATION LOOP
// ==========================================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsedTime = clock.getElapsedTime();

  // Scroll velocity decay
  scrollVelocity *= 0.90;
  if (particleMaterial) {
    particleMaterial.uniforms.uVelocity.value = scrollVelocity;
    particleMaterial.uniforms.uTime.value = elapsedTime;
  }

  // Tactile Mouse Parallax
  if (particleMesh) {
    particleMesh.rotation.y += (targetTiltY - particleMesh.rotation.y) * 0.05;
    particleMesh.rotation.x += (targetTiltX - particleMesh.rotation.x) * 0.05;
  }

  if (realCameraGroup) {
    realCameraGroup.rotation.y += (targetTiltY + 0.25 - realCameraGroup.rotation.y) * 0.06;
    realCameraGroup.rotation.x += (targetTiltX + 0.05 - realCameraGroup.rotation.x) * 0.06;
  }

  if (photoPlaneEmbroidery) {
    const basePosY = isMobile() ? -1.15 : 0.35;
    photoPlaneEmbroidery.position.y = basePosY + Math.sin(elapsedTime * 1.2) * 0.04;
    photoPlaneEmbroidery.rotation.y = (isMobile() ? -0.10 : -0.26) + targetTiltY * 0.4;
  }
  if (photoPlaneCrimea) {
    const basePosY = isMobile() ? -2.1 : -0.45;
    photoPlaneCrimea.position.y = basePosY + Math.cos(elapsedTime * 1.4) * 0.04;
    photoPlaneCrimea.rotation.y = (isMobile() ? -0.05 : -0.24) + targetTiltY * 0.4;
  }

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
