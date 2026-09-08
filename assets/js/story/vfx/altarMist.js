/**
 * assets/js/story/vfx/altarMist.js
 * 
 * Hybrid Altar Mist & Volumetric Smoke Shroud (Option 1 + Option 2)
 * Designed for DeusFlow 3D Cinematic Story.
 * Fully compliant with AGENTS.md:
 * - Option 1: Ground Creeping Mist (horizontal multi-layered rotating cushions masking floor/base cracks)
 * - Option 2: Volumetric Soft Mist/Smoke Puffs (3D intersecting physical quads shrouding altar seams)
 * - Strict Prohibition: Zero gl_PointSize / gl_PointCoord (physical 3D polygonal quads only)
 * - Depth-Write Integrity: depthWrite = false, renderOrder = 2, DoubleSide
 * - Atmospheric Aesthetic: Archival sapphire-ink and deep midnight blues complementing Hogwarts Library
 * - The One-Effect Rule: Quiet masking shroud that stays subordinate to the central Blue Goblet Fire at fog2
 */
import * as THREE from 'three';
import { ALTAR_MIST_CONFIG, rawAltarMistConfig, registerAltarMistConfigListener } from '../storyConfig.js';

let fog1RootGroup = null;
let fire001RootGroup = null;
let groundMeshes = [];
let puffMeshes = [];
let groundMaterial = null;
let puffMaterial = null;

const altarMistUniforms = {
  uTime: { value: 0 },
  uOpacity: { value: ALTAR_MIST_CONFIG.opacity },
  uFlowSpeed: { value: ALTAR_MIST_CONFIG.flowSpeed },
  uPuffDensity: { value: ALTAR_MIST_CONFIG.puffDensity },
  uGroundColor: { value: ALTAR_MIST_CONFIG.groundColor },
  uPuffColor: { value: ALTAR_MIST_CONFIG.puffColor },
  uRimColor: { value: ALTAR_MIST_CONFIG.rimColor }
};

// Common GLSL 2D Simplex Noise for procedural fluid turbulence
const simplexNoiseGLSL = `
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

/**
 * Live configuration applicator: called whenever ALTAR_MIST_CONFIG is changed in console or code.
 */
export function applyAltarMistConfig(prop, val) {
  if (prop === 'opacity') {
    const num = Number(val);
    rawAltarMistConfig.opacity = num;
    altarMistUniforms.uOpacity.value = num;
  } else if (prop === 'puffDensity') {
    const num = Number(val);
    rawAltarMistConfig.puffDensity = num;
    altarMistUniforms.uPuffDensity.value = num;
  } else if (prop === 'flowSpeed') {
    const num = Number(val);
    rawAltarMistConfig.flowSpeed = num;
    altarMistUniforms.uFlowSpeed.value = num;
  } else if (prop === 'groundRadius') {
    const r = Number(val);
    rawAltarMistConfig.groundRadius = r;
    groundMeshes.forEach((item) => {
      const mult = item.baseMultiplier || 1.0;
      item.mesh.scale.set(r * mult, r * mult, 1.0);
    });
  } else if (prop === 'puffRadius' || prop === 'puffHeight') {
    const r = Number(rawAltarMistConfig.puffRadius);
    const h = Number(rawAltarMistConfig.puffHeight);
    puffMeshes.forEach((item) => {
      const mult = item.baseMultiplier || 1.0;
      item.mesh.scale.set(r * mult, h * mult, 1.0);
      item.mesh.position.y = (h * mult) * 0.45;
    });
  } else if (prop === 'scale') {
    if (Array.isArray(val)) {
      rawAltarMistConfig.scale = val;
      if (fog1RootGroup) fog1RootGroup.scale.set(val[0], val[1], val[2]);
      if (fire001RootGroup) fire001RootGroup.scale.set(val[0], val[1], val[2]);
    } else if (typeof val === 'number') {
      rawAltarMistConfig.scale = [val, val, val];
      if (fog1RootGroup) fog1RootGroup.scale.set(val, val, val);
      if (fire001RootGroup) fire001RootGroup.scale.set(val, val, val);
    }
  } else if (prop === 'offsetFog1' && fog1RootGroup) {
    if (Array.isArray(val)) {
      rawAltarMistConfig.offsetFog1 = val;
      fog1RootGroup.position.set(val[0], val[1], val[2]);
    }
  } else if (prop === 'offsetFire001' && fire001RootGroup) {
    if (Array.isArray(val)) {
      rawAltarMistConfig.offsetFire001 = val;
      fire001RootGroup.position.set(val[0], val[1], val[2]);
    }
  } else if (prop === 'groundColor') {
    if (val instanceof THREE.Color) altarMistUniforms.uGroundColor.value.copy(val);
    else altarMistUniforms.uGroundColor.value.set(val);
  } else if (prop === 'puffColor') {
    if (val instanceof THREE.Color) altarMistUniforms.uPuffColor.value.copy(val);
    else altarMistUniforms.uPuffColor.value.set(val);
  } else if (prop === 'rimColor') {
    if (val instanceof THREE.Color) altarMistUniforms.uRimColor.value.copy(val);
    else altarMistUniforms.uRimColor.value.set(val);
  }
}

// Register dynamic configuration listener
registerAltarMistConfigListener(applyAltarMistConfig);

/**
 * Creates Ground Creeping Mist layer (Option 1).
 * Horizontal disc planes with soft radial alpha and rotational Simplex curl.
 */
function createGroundMistLayer(radius, yOffset, rotationZ, baseMultiplier, rotSpeed) {
  const geom = new THREE.PlaneGeometry(2.0, 2.0, 1, 1);
  const mesh = new THREE.Mesh(geom, groundMaterial);
  mesh.rotation.x = -Math.PI * 0.5;
  mesh.rotation.z = rotationZ;
  mesh.position.y = yOffset;
  mesh.scale.set(radius * baseMultiplier, radius * baseMultiplier, 1.0);
  mesh.renderOrder = 2;

  groundMeshes.push({
    mesh,
    baseMultiplier,
    rotSpeed
  });

  return mesh;
}

/**
 * Creates Volumetric Soft Mist Puff layer (Option 2).
 * Intersecting 3D polygonal planes with smooth radial falloff and ascending billow.
 */
function createVolumetricPuffCluster(puffRadius, puffHeight) {
  const cluster = new THREE.Group();
  const angles = [0, Math.PI * 0.25, Math.PI * 0.5, Math.PI * 0.75];

  angles.forEach((angle, idx) => {
    const geom = new THREE.PlaneGeometry(2.0, 2.0, 1, 1);
    const mesh = new THREE.Mesh(geom, puffMaterial);
    mesh.rotation.y = angle;
    // Subtle tilt for 3D fullness
    mesh.rotation.x = ((idx % 2 === 0 ? 1 : -1) * 0.08);
    mesh.position.y = puffHeight * 0.45;
    
    const mult = 0.85 + (idx % 3) * 0.15;
    mesh.scale.set(puffRadius * mult, puffHeight * mult, 1.0);
    mesh.renderOrder = 2;

    puffMeshes.push({
      mesh,
      baseMultiplier: mult,
      seed: idx * 1.618
    });

    cluster.add(mesh);
  });

  return cluster;
}

/**
 * Builds the hybrid Altar Mist system and attaches to fog1 and fire001 empty nodes.
 */
export function createAltarMist(fog1Node, fire001Node) {
  if (!fog1Node && !fire001Node) {
    console.warn('[AltarMist] Neither "fog1" nor "fire001" found in scene.');
    return;
  }

  // 1. Initialize Ground Mist ShaderMaterial (Option 1)
  groundMaterial = new THREE.ShaderMaterial({
    uniforms: altarMistUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;

      void main() {
        vUv = uv;
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uFlowSpeed;
      uniform vec3 uGroundColor;
      uniform vec3 uRimColor;

      ${simplexNoiseGLSL}

      void main() {
        vec2 centeredUv = vUv - 0.5;
        float dist = length(centeredUv) * 2.0;

        // Smooth buttery radial falloff (zero harsh polygon edges)
        float radialFade = smoothstep(1.0, 0.08, dist);

        // Procedural polar Simplex noise swirl
        float angle = atan(centeredUv.y, centeredUv.x);
        vec2 polarUv = vec2(dist * 1.8 - uTime * 0.08 * uFlowSpeed, angle * 1.27);
        float n1 = snoise(polarUv);
        float n2 = snoise(vec2(vUv.x * 3.5 + uTime * 0.05 * uFlowSpeed, vUv.y * 3.5 - uTime * 0.04 * uFlowSpeed));
        float curlNoise = n1 * 0.6 + n2 * 0.4;

        float alpha = radialFade * smoothstep(-0.35, 0.65, curlNoise) * uOpacity;

        // Rich archival blue gradient: deep ground tone blending to soft rim highlight
        vec3 col = mix(uGroundColor, uRimColor, clamp((curlNoise + 0.3) * 0.65, 0.0, 1.0));

        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
      }
    `
  });

  // 2. Initialize Volumetric Mist Puff ShaderMaterial (Option 2)
  puffMaterial = new THREE.ShaderMaterial({
    uniforms: altarMistUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;

      void main() {
        vUv = uv;
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uPuffDensity;
      uniform float uFlowSpeed;
      uniform vec3 uPuffColor;
      uniform vec3 uRimColor;

      ${simplexNoiseGLSL}

      void main() {
        vec2 centeredUv = vUv - 0.5;
        // Soft elliptical vertical volume
        float dist = length(vec2(centeredUv.x, centeredUv.y * 1.15)) * 2.0;
        float radialFade = smoothstep(0.98, 0.05, dist);

        // Rising billowing smoke turbulence
        vec2 billowUv = vec2(vUv.x * 2.8, vUv.y * 2.2 - uTime * 0.14 * uFlowSpeed);
        float n1 = snoise(billowUv);
        float n2 = snoise(billowUv * 1.85 + vec2(0.4, -uTime * 0.09 * uFlowSpeed));
        float billow = n1 * 0.65 + n2 * 0.35;

        float alpha = radialFade * smoothstep(-0.3, 0.7, billow) * uOpacity * uPuffDensity;

        // Atmospheric soft smoky navy-sapphire tone
        vec3 col = mix(uPuffColor, uRimColor, clamp((billow + 0.25) * 0.75, 0.0, 1.0));

        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
      }
    `
  });

  const r = rawAltarMistConfig.groundRadius;
  const pr = rawAltarMistConfig.puffRadius;
  const ph = rawAltarMistConfig.puffHeight;

  // 3. Build Node 1: fog1 (Right side of altar)
  if (fog1Node) {
    fog1RootGroup = new THREE.Group();
    fog1RootGroup.name = 'AltarMist_Fog1_Group';
    const off = rawAltarMistConfig.offsetFog1;
    fog1RootGroup.position.set(off[0], off[1], off[2]);

    const sc = rawAltarMistConfig.scale;
    if (Array.isArray(sc)) fog1RootGroup.scale.set(sc[0], sc[1], sc[2]);

    // Option 1: Ground Creeping Mist (2 counter-rotating layers)
    fog1RootGroup.add(createGroundMistLayer(r, 0.02, 0.0, 1.0, 0.04));
    fog1RootGroup.add(createGroundMistLayer(r, 0.05, Math.PI * 0.35, 1.18, -0.03));

    // Option 2: Volumetric Soft Mist Puff cluster
    fog1RootGroup.add(createVolumetricPuffCluster(pr, ph));

    fog1Node.add(fog1RootGroup);
    console.log('[AltarMist] Attached hybrid mist shroud to "fog1" at', fog1Node.position.toArray());
  }

  // 4. Build Node 2: fire.001 / fire001 (Left / rear side of altar)
  if (fire001Node) {
    fire001RootGroup = new THREE.Group();
    fire001RootGroup.name = 'AltarMist_Fire001_Group';
    const off = rawAltarMistConfig.offsetFire001;
    fire001RootGroup.position.set(off[0], off[1], off[2]);

    const sc = rawAltarMistConfig.scale;
    if (Array.isArray(sc)) fire001RootGroup.scale.set(sc[0], sc[1], sc[2]);

    // Option 1: Ground Creeping Mist (2 counter-rotating layers)
    fire001RootGroup.add(createGroundMistLayer(r, 0.02, Math.PI * 0.5, 1.05, 0.035));
    fire001RootGroup.add(createGroundMistLayer(r, 0.05, Math.PI * 0.85, 1.22, -0.028));

    // Option 2: Volumetric Soft Mist Puff cluster
    fire001RootGroup.add(createVolumetricPuffCluster(pr, ph));

    fire001Node.add(fire001RootGroup);
    console.log('[AltarMist] Attached hybrid mist shroud to "fire001" at', fire001Node.position.toArray());
  }
}

/**
 * Main animation update loop: advances procedural noise and subtle undulation.
 */
export function updateAltarMist(elapsed, delta, camera) {
  if (!fog1RootGroup && !fire001RootGroup) return;

  altarMistUniforms.uTime.value = elapsed;

  const flow = rawAltarMistConfig.flowSpeed;

  // Gentle rotation of ground mist cushions
  groundMeshes.forEach((item) => {
    item.mesh.rotation.z += delta * item.rotSpeed * flow;
  });

  // Gentle breathing undulation for volumetric smoke puffs
  puffMeshes.forEach((item) => {
    const breathe = Math.sin(elapsed * 0.85 * flow + item.seed) * 0.03;
    item.mesh.position.y = (rawAltarMistConfig.puffHeight * item.baseMultiplier) * 0.45 + breathe;
  });
}

/**
 * Clean GPU memory disposal.
 */
export function cleanupAltarMist() {
  groundMeshes.forEach((item) => {
    if (item.mesh.geometry) item.mesh.geometry.dispose();
  });
  groundMeshes = [];

  puffMeshes.forEach((item) => {
    if (item.mesh.geometry) item.mesh.geometry.dispose();
  });
  puffMeshes = [];

  if (groundMaterial) {
    groundMaterial.dispose();
    groundMaterial = null;
  }

  if (puffMaterial) {
    puffMaterial.dispose();
    puffMaterial = null;
  }

  if (fog1RootGroup) {
    fog1RootGroup.parent?.remove(fog1RootGroup);
    fog1RootGroup = null;
  }

  if (fire001RootGroup) {
    fire001RootGroup.parent?.remove(fire001RootGroup);
    fire001RootGroup = null;
  }
}

/**
 * Current runtime state for testing & DevTools.
 */
export function getAltarMistState() {
  return {
    hasAltarMist: !!(fog1RootGroup || fire001RootGroup),
    fog1Active: !!fog1RootGroup,
    fire001Active: !!fire001RootGroup,
    groundLayersCount: groundMeshes.length,
    puffLayersCount: puffMeshes.length,
    opacity: altarMistUniforms.uOpacity.value
  };
}
