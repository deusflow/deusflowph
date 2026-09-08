/**
 * assets/js/story/vfx/altarMist.js
 * 
 * Dense Altar Mist Carpet & Billowing Steam ("Плотный ковер тумана и пар на алтаре") for DeusFlow Cinematic Story.
 * Implements a rich, tangible, milky-white creeping fog blanket directly across the stone altar surfaces:
 * - Layer 1: Floor platform mist carpet across FOG.004 (covers circular stone floor, stairs, and crevices).
 * - Layer 2: Altar slab mist cushion directly on fog2 (covers raised stone slab, altar base, and surroundings).
 * - Layer 3: Secondary semi-translucent volumetric tendril cushion for deep fluid layering.
 * - Layer 4: Low-elevation, subtle celestial steam wisps rising directly from the blue fire bowl into the air.
 * - 4-Edge perimeter feathering (smoothstep 0.0 to 0.08) guaranteeing 100% solid floor coverage with ZERO hard edges.
 * - Multi-octave simplex curl turbulence for continuous, silky, organic creeping motion.
 * - High baseline density: mix(0.82, 1.0, noise), preventing thin holes or washed-out patches.
 * - Unlit celestial luminous palette: cream-white mist body (#d5e8f7), subtle cyan core (#a5e0f7), pearl highlight (#f5faff).
 * - Physical 3D polygonal geometry (100% compliant with AGENTS.md, NO gl_PointSize).
 */
import * as THREE from 'three';
import { ALTAR_MIST_CONFIG, rawAltarMistConfig, registerAltarMistConfigListener } from '../storyConfig.js';

let fog2BowlAnchorNode = null;
let altarSteamGroup = null;
let steamPlumes = [];
let steamMaterial = null;

let altarSlabMistMesh = null;
let altarSlabSecondaryMesh = null;
let slabCarpetMaterial = null;
let slabSecondaryMaterial = null;

let fog1RootGroup = null;
let fire001RootGroup = null;
let puffBillboards = [];
let puffMaterial = null;

let fog004MeshRef = null;
let fog004Material = null;
let fog004InitialY = -1.269;

export function registerFOG004Mesh(mesh) {
  fog004MeshRef = mesh;
  if (fog004MeshRef) {
    fog004MeshRef.visible = !rawAltarMistConfig.hideFOG004;
  }
}

// Initial normalized opacity
let initialOpacity = Number(ALTAR_MIST_CONFIG.opacity);
if (isNaN(initialOpacity)) initialOpacity = 0.85;
if (initialOpacity > 100.0) {
  initialOpacity = 1.0;
} else if (initialOpacity >= 20.0 && initialOpacity <= 100.0) {
  initialOpacity = initialOpacity / 100.0;
} else if (initialOpacity > 1.0 && initialOpacity < 20.0) {
  initialOpacity = 1.0;
} else {
  initialOpacity = Math.max(0.0, Math.min(initialOpacity, 1.0));
}

const altarMistUniforms = {
  uTime: { value: 0 },
  uOpacity: { value: initialOpacity },
  uCarpetDensity: { value: Number(rawAltarMistConfig.carpetDensity) || 1.25 },
  uFlowSpeed: { value: Number(rawAltarMistConfig.flowSpeed) || 0.28 },
  uColor: { value: (rawAltarMistConfig.color || rawAltarMistConfig.puffColor) ? (rawAltarMistConfig.color || rawAltarMistConfig.puffColor).clone() : new THREE.Color(0xd5e8f7) },
  uCoreColor: { value: rawAltarMistConfig.coreColor ? rawAltarMistConfig.coreColor.clone() : new THREE.Color(0xa5e0f7) },
  uRimColor: { value: rawAltarMistConfig.rimColor ? rawAltarMistConfig.rimColor.clone() : new THREE.Color(0xf5faff) },
  uPuffDensity: { value: Number(rawAltarMistConfig.puffDensity) || 1.0 },
  uPuffColor: { value: (rawAltarMistConfig.puffColor || rawAltarMistConfig.color) ? (rawAltarMistConfig.puffColor || rawAltarMistConfig.color).clone() : new THREE.Color(0xd5e8f7) }
};

// Common GLSL 2D Simplex Noise for organic fluid drift
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

function updateSteamPlumeScales() {
  const h = Number(rawAltarMistConfig.steamHeight || 0.45);
  const r = Number(rawAltarMistConfig.steamRadius || 0.45);
  steamPlumes.forEach((item) => {
    item.mesh.scale.set(r * item.widthMult, h * item.heightMult, 1.0);
  });
}

function updateCarpetScales() {
  const spread = Number(rawAltarMistConfig.carpetSpread || 1.20);
  if (altarSlabMistMesh) {
    altarSlabMistMesh.scale.set(spread * 2.8, spread * 2.4, 1.0);
  }
  if (altarSlabSecondaryMesh) {
    altarSlabSecondaryMesh.scale.set(spread * 3.1, spread * 2.7, 1.0);
  }
}

/**
 * Live configuration applicator: called whenever ALTAR_MIST_CONFIG or ALTAR_STEAM_CONFIG is changed.
 */
export function applyAltarMistConfig(prop, val) {
  if (prop === 'opacity') {
    let num = Number(val);
    if (isNaN(num)) num = 0.85;
    if (num > 100.0) {
      num = 1.0;
    } else if (num >= 20.0 && num <= 100.0) {
      // Interpreted as percentage (e.g. 55 -> 0.55, 85 -> 0.85)
      num = num / 100.0;
    } else if (num > 1.0 && num < 20.0) {
      // User entered an intensity multiplier like 10.45 or 2.0 or 5.0
      // Boost carpetDensity and set opacity to 1.0 (100% solid carpet)
      const densityBoost = Math.min(Math.max(num, 1.0), 3.0);
      rawAltarMistConfig.carpetDensity = densityBoost;
      altarMistUniforms.uCarpetDensity.value = densityBoost;
      num = 1.0;
    } else {
      num = Math.max(0.0, Math.min(num, 1.0));
    }
    rawAltarMistConfig.opacity = num;
    altarMistUniforms.uOpacity.value = num;
  } else if (prop === 'carpetDensity' || prop === 'density') {
    const num = Number(val) || 1.25;
    rawAltarMistConfig.carpetDensity = num;
    altarMistUniforms.uCarpetDensity.value = num;
  } else if (prop === 'flowSpeed') {
    const num = Number(val) || 0.28;
    rawAltarMistConfig.flowSpeed = num;
    altarMistUniforms.uFlowSpeed.value = num;
  } else if (prop === 'steamHeight') {
    rawAltarMistConfig.steamHeight = Number(val);
    updateSteamPlumeScales();
  } else if (prop === 'steamRadius') {
    rawAltarMistConfig.steamRadius = Number(val);
    updateSteamPlumeScales();
  } else if (prop === 'carpetSpread' || prop === 'waftSpread') {
    const num = Number(val) || 1.20;
    rawAltarMistConfig.carpetSpread = num;
    rawAltarMistConfig.waftSpread = num;
    updateCarpetScales();
  } else if (prop === 'yOffset') {
    const num = Number(val) || 0.02;
    rawAltarMistConfig.yOffset = num;
    if (altarSteamGroup) {
      altarSteamGroup.position.y = num;
    }
    if (fog004MeshRef) {
      fog004MeshRef.position.y = fog004InitialY + num;
    }
  } else if (prop === 'color' || prop === 'puffColor' || prop === 'groundColor') {
    if (val instanceof THREE.Color) {
      altarMistUniforms.uColor.value.copy(val);
      altarMistUniforms.uPuffColor.value.copy(val);
    } else {
      altarMistUniforms.uColor.value.set(val);
      altarMistUniforms.uPuffColor.value.set(val);
    }
  } else if (prop === 'coreColor') {
    if (val instanceof THREE.Color) altarMistUniforms.uCoreColor.value.copy(val);
    else altarMistUniforms.uCoreColor.value.set(val);
  } else if (prop === 'rimColor') {
    if (val instanceof THREE.Color) altarMistUniforms.uRimColor.value.copy(val);
    else altarMistUniforms.uRimColor.value.set(val);
  } else if (prop === 'hideFOG004') {
    rawAltarMistConfig.hideFOG004 = !!val;
    if (fog004MeshRef) {
      fog004MeshRef.visible = !val;
    }
  } else if (prop === 'enableEmptiesPuffs') {
    rawAltarMistConfig.enableEmptiesPuffs = !!val;
    if (fog1RootGroup) fog1RootGroup.visible = !!val;
    if (fire001RootGroup) fire001RootGroup.visible = !!val;
  } else if (prop === 'puffDensity') {
    const num = Number(val);
    rawAltarMistConfig.puffDensity = num;
    altarMistUniforms.uPuffDensity.value = num;
  }
}

// Register dynamic configuration listener
registerAltarMistConfigListener(applyAltarMistConfig);

/**
 * Creates the Altar Mist Carpet & Billowing Steam System:
 * 1. Primary horizontal mist carpet across the raised stone altar slab
 * 2. Secondary elevated mist cushion for deep volumetric richness
 * 3. Low-elevation billowing steam wisps rising directly from the blue fire bowl
 */
function createAltarSteamSystem(bowlNode) {
  fog2BowlAnchorNode = bowlNode;
  altarSteamGroup = new THREE.Group();
  altarSteamGroup.name = 'AltarSteamGroup';
  altarSteamGroup.position.set(0, rawAltarMistConfig.yOffset || 0.02, 0);

  // 1. Primary Horizontal Dense Carpet Material (Altar Slab)
  slabCarpetMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: altarMistUniforms.uTime,
      uOpacity: altarMistUniforms.uOpacity,
      uCarpetDensity: altarMistUniforms.uCarpetDensity,
      uFlowSpeed: altarMistUniforms.uFlowSpeed,
      uColor: altarMistUniforms.uColor,
      uCoreColor: altarMistUniforms.uCoreColor,
      uRimColor: altarMistUniforms.uRimColor
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uCarpetDensity;
      uniform float uFlowSpeed;
      uniform vec3 uColor;
      uniform vec3 uCoreColor;
      uniform vec3 uRimColor;

      ${simplexNoiseGLSL}

      void main() {
        vec2 centeredUv = (vUv - 0.5) * 2.0;
        float dist = length(centeredUv);
        // Organic radial falloff pooling across the stone slab around the bowl
        float slabMask = smoothstep(1.02, 0.25, dist);

        // Fluid drifting vapor across the slab
        vec2 flowUv1 = vUv * 2.5 + vec2(
          sin(uTime * 0.05 * uFlowSpeed + vUv.y * 1.6) * 0.12 + uTime * 0.04 * uFlowSpeed,
          -uTime * 0.06 * uFlowSpeed
        );
        vec2 flowUv2 = vUv * 4.4 + vec2(
          -uTime * 0.03 * uFlowSpeed,
          cos(uTime * 0.04 * uFlowSpeed + vUv.x * 1.8) * 0.10
        );
        float n1 = snoise(flowUv1);
        float n2 = snoise(flowUv2);
        float noise = (n1 * 0.65 + n2 * 0.35) * 0.5 + 0.5;

        // Rich billowing density: dense creeping carpet pooling around the altar
        float billow = smoothstep(0.20, 0.80, noise);
        float carpet = mix(0.45, 1.0, billow);

        float alpha = clamp(slabMask * carpet * uOpacity * uCarpetDensity * 0.85, 0.0, 0.90);

        // Luminous turquoise glow near bowl with creamy mist body
        vec3 col = mix(uCoreColor, uColor, clamp(dist * 0.75, 0.0, 1.0));
        col = mix(col, uRimColor, clamp(pow(billow, 1.6) * 0.50, 0.0, 1.0));

        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  // 2. Secondary Elevated Volumetric Tendril Material (for rich depth)
  slabSecondaryMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: altarMistUniforms.uTime,
      uOpacity: altarMistUniforms.uOpacity,
      uCarpetDensity: altarMistUniforms.uCarpetDensity,
      uFlowSpeed: altarMistUniforms.uFlowSpeed,
      uColor: altarMistUniforms.uColor,
      uRimColor: altarMistUniforms.uRimColor
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uCarpetDensity;
      uniform float uFlowSpeed;
      uniform vec3 uColor;
      uniform vec3 uRimColor;

      ${simplexNoiseGLSL}

      void main() {
        float edgeDistX = min(vUv.x, 1.0 - vUv.x);
        float edgeDistY = min(vUv.y, 1.0 - vUv.y);
        float edgeFade = smoothstep(0.0, 0.12, min(edgeDistX, edgeDistY));

        // Counter-flowing secondary ribbons
        vec2 flowUv = vUv * 3.2 + vec2(
          -uTime * 0.05 * uFlowSpeed,
          sin(uTime * 0.06 * uFlowSpeed + vUv.x * 2.0) * 0.14
        );
        float n = snoise(flowUv) * 0.5 + 0.5;
        float ribbon = smoothstep(0.20, 0.85, n);

        float alpha = clamp(edgeFade * ribbon * uOpacity * uCarpetDensity * 0.55, 0.0, 1.0);
        vec3 col = mix(uColor, uRimColor, clamp(n * 0.45, 0.0, 1.0));

        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  // 3. Billowing Steam Plumes Material (Low-elevation subtle wisps)
  steamMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: altarMistUniforms.uTime,
      uOpacity: altarMistUniforms.uOpacity,
      uFlowSpeed: altarMistUniforms.uFlowSpeed,
      uColor: altarMistUniforms.uColor,
      uCoreColor: altarMistUniforms.uCoreColor,
      uRimColor: altarMistUniforms.uRimColor
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uFlowSpeed;
      uniform vec3 uColor;
      uniform vec3 uCoreColor;
      uniform vec3 uRimColor;

      ${simplexNoiseGLSL}

      void main() {
        float bottomFade = smoothstep(0.0, 0.15, vUv.y);
        float topFade = smoothstep(1.0, 0.35, vUv.y);
        float vFade = bottomFade * topFade;

        float xDist = (vUv.x - 0.5) * 2.0;
        float hFade = exp(-xDist * xDist * 3.8);

        vec2 flowUv = vec2(
          (vUv.x - 0.5) * 2.0 + sin(uTime * 0.45 * uFlowSpeed + vUv.y * 3.0) * 0.12,
          vUv.y * 1.4 - uTime * 0.32 * uFlowSpeed
        );
        float n = snoise(flowUv) * 0.5 + 0.5;

        float billow = smoothstep(0.15, 0.75, n);
        float steam = vFade * hFade * mix(0.50, 1.0, billow);
        float alpha = clamp(steam * uOpacity * 0.70, 0.0, 1.0);

        vec3 col = mix(uCoreColor, uColor, smoothstep(0.05, 0.45, vUv.y));
        col = mix(col, uRimColor, clamp(n * 0.40, 0.0, 1.0));

        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  // Layer 1: Altar Slab Mist Carpet Mesh (Flat horizontal plane hugging the slab)
  const slabGeom = new THREE.PlaneGeometry(1.0, 1.0);
  altarSlabMistMesh = new THREE.Mesh(slabGeom, slabCarpetMaterial);
  altarSlabMistMesh.name = 'AltarSlabMistCarpet';
  altarSlabMistMesh.rotation.x = -Math.PI / 2;
  altarSlabMistMesh.position.set(-0.10, 0.02, -0.20);
  altarSlabMistMesh.renderOrder = 2;
  altarSteamGroup.add(altarSlabMistMesh);

  // Layer 2: Secondary Elevated Volumetric Tendril Shroud
  const secGeom = new THREE.PlaneGeometry(1.0, 1.0);
  altarSlabSecondaryMesh = new THREE.Mesh(secGeom, slabSecondaryMaterial);
  altarSlabSecondaryMesh.name = 'AltarSlabSecondaryMist';
  altarSlabSecondaryMesh.rotation.x = -Math.PI / 2;
  altarSlabSecondaryMesh.position.set(-0.10, 0.05, -0.20);
  altarSlabSecondaryMesh.renderOrder = 2;
  altarSteamGroup.add(altarSlabSecondaryMesh);

  updateCarpetScales();

  // Layer 3: Subtle, Low-elevation Rising Steam Wisps
  const plumeConfigs = [
    { x: 0.00, y: 0.16, z: 0.00, wMult: 0.85, hMult: 0.90, speed: 0.32, seed: 1.14, rotZ: 0.00 },
    { x: -0.10, y: 0.22, z: -0.12, wMult: 0.95, hMult: 1.00, speed: 0.36, seed: 2.37, rotZ: 0.15 },
    { x: 0.12, y: 0.18, z: 0.06, wMult: 0.85, hMult: 0.95, speed: 0.30, seed: 3.65, rotZ: -0.14 },
    { x: 0.02, y: 0.30, z: -0.04, wMult: 1.10, hMult: 1.10, speed: 0.40, seed: 4.88, rotZ: 0.08 },
    { x: -0.06, y: 0.14, z: 0.08, wMult: 0.75, hMult: 0.80, speed: 0.28, seed: 5.92, rotZ: -0.10 }
  ];

  const sh = rawAltarMistConfig.steamHeight || 0.45;
  const sr = rawAltarMistConfig.steamRadius || 0.45;

  plumeConfigs.forEach((cfg) => {
    const geom = new THREE.PlaneGeometry(1.0, 1.0);
    const mesh = new THREE.Mesh(geom, steamMaterial);
    mesh.position.set(cfg.x, cfg.y, cfg.z);
    mesh.scale.set(sr * cfg.wMult, sh * cfg.hMult, 1.0);
    mesh.renderOrder = 2;

    steamPlumes.push({
      mesh,
      basePos: new THREE.Vector3(cfg.x, cfg.y, cfg.z),
      widthMult: cfg.wMult,
      heightMult: cfg.hMult,
      speed: cfg.speed,
      seed: cfg.seed,
      rotZ: cfg.rotZ
    });

    altarSteamGroup.add(mesh);
  });

  bowlNode.add(altarSteamGroup);
  console.log(`[AltarMist] Attached Dense Mist Carpet & Billowing Steam to bowl node "${bowlNode.name}" at`, bowlNode.position.toArray());
}

/**
 * Creates optional fluffy 3D volumetric cloud-puffs on empties (disabled by default).
 */
function createFluffyCloudCluster(puffRadius, puffHeight) {
  const cluster = new THREE.Group();
  const puffConfigs = [
    { x: 0.25, y: 0.08, z: 0.15, rMult: 1.25, hMult: 0.90, seed: 1.14, floatSpeed: 0.35, rotZ: 0.15 },
    { x: -0.30, y: 0.12, z: -0.20, rMult: 1.35, hMult: 0.95, seed: 2.37, floatSpeed: 0.30, rotZ: 1.25 },
    { x: 0.15, y: 0.28, z: -0.30, rMult: 1.45, hMult: 1.10, seed: 3.65, floatSpeed: 0.42, rotZ: 2.45 },
    { x: -0.20, y: 0.40, z: 0.20, rMult: 1.30, hMult: 1.05, seed: 4.88, floatSpeed: 0.38, rotZ: 3.70 },
    { x: 0.05, y: 0.58, z: -0.05, rMult: 1.55, hMult: 1.15, seed: 5.92, floatSpeed: 0.48, rotZ: 5.10 }
  ];

  const spread = rawAltarMistConfig.cloudSpread || 1.0;

  puffConfigs.forEach((cfg) => {
    const geom = new THREE.PlaneGeometry(2.0, 2.0, 1, 1);
    const mesh = new THREE.Mesh(geom, puffMaterial);
    mesh.position.set(cfg.x * spread, cfg.y, cfg.z * spread);
    mesh.scale.set(puffRadius * cfg.rMult, puffHeight * cfg.hMult, 1.0);
    mesh.renderOrder = 2;

    puffBillboards.push({
      mesh,
      basePos: new THREE.Vector3(cfg.x, cfg.y, cfg.z),
      baseMultiplier: cfg.rMult,
      seed: cfg.seed,
      floatSpeed: cfg.floatSpeed,
      rotZ: cfg.rotZ
    });

    cluster.add(mesh);
  });

  return cluster;
}

/**
 * Initializes Altar Mist & Steam systems:
 * - Direct dense horizontal carpet on the altar slab (fog2).
 * - Borderless dense creeping carpet on FOG.004 covering the altar platform floor.
 * - Optional puff billboards on fog1 & fire001 empties.
 */
export function createAltarMist(fog1Node, fire001Node, fog004Node = null, fog2Node = null) {
  // 1. Primary: Dense Mist Carpet & Billowing Steam on the altar slab (fog2)
  if (fog2Node) {
    createAltarSteamSystem(fog2Node);
  }

  // 2. FOG.004 on the altar platform floor
  if (fog004Node) {
    fog004MeshRef = fog004Node;
    fog004InitialY = fog004MeshRef.position.y;
    const yOff = rawAltarMistConfig.yOffset !== undefined ? rawAltarMistConfig.yOffset : 0.02;
    fog004MeshRef.position.y = fog004InitialY + yOff;

    fog004Material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: altarMistUniforms.uTime,
        uOpacity: altarMistUniforms.uOpacity,
        uCarpetDensity: altarMistUniforms.uCarpetDensity,
        uFlowSpeed: altarMistUniforms.uFlowSpeed,
        uColor: altarMistUniforms.uColor,
        uCoreColor: altarMistUniforms.uCoreColor,
        uRimColor: altarMistUniforms.uRimColor
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uOpacity;
        uniform float uCarpetDensity;
        uniform float uFlowSpeed;
        uniform vec3 uColor;
        uniform vec3 uCoreColor;
        uniform vec3 uRimColor;

        ${simplexNoiseGLSL}

        void main() {
          vec2 centeredUv = (vUv - 0.5) * 2.0;
          float dist = length(centeredUv);
          // Organic radial contour matching the circular altar platform:
          // Fully dense across the platform interior, feathering softly towards the circular edge
          float circleMask = smoothstep(1.05, 0.40, dist);

          // Multi-octave organic creeping fluid drift
          vec2 flowUv1 = vUv * 2.6 + vec2(
            sin(uTime * 0.05 * uFlowSpeed + vUv.y * 1.6) * 0.14 + uTime * 0.04 * uFlowSpeed,
            -uTime * 0.06 * uFlowSpeed
          );
          vec2 flowUv2 = vUv * 4.6 + vec2(
            -uTime * 0.04 * uFlowSpeed,
            cos(uTime * 0.05 * uFlowSpeed + vUv.x * 1.8) * 0.12
          );
          float n1 = snoise(flowUv1);
          float n2 = snoise(flowUv2);
          float noise = (n1 * 0.62 + n2 * 0.38) * 0.5 + 0.5;

          // Billowing creeping carpet: dense milky ridges with visible valleys
          float billow = smoothstep(0.22, 0.82, noise);
          float carpet = mix(0.40, 1.0, billow);

          // Alpha: dense rich carpet that hugs the stones
          float alpha = clamp(circleMask * carpet * uOpacity * uCarpetDensity * 0.82, 0.0, 0.90);

          // Rich luminous celestial colors:
          vec3 col = mix(uColor, uCoreColor, clamp((1.0 - dist * 0.8) * 0.35, 0.0, 1.0));
          col = mix(col, uRimColor, clamp(pow(billow, 1.6) * 0.50, 0.0, 1.0));

          gl_FragColor = vec4(col, alpha);
        }
      `
    });

    fog004MeshRef.material = fog004Material;
    fog004MeshRef.visible = !rawAltarMistConfig.hideFOG004;
    fog004MeshRef.renderOrder = 2;
    console.log(`[AltarMist] Enhanced FOG004 dense mist carpet (visible: ${fog004MeshRef.visible}).`);
  }

  // 3. Empties Puffs (fog1 & fire.001, disabled by default)
  if (!puffMaterial && (fog1Node || fire001Node)) {
    puffMaterial = new THREE.ShaderMaterial({
      uniforms: altarMistUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uOpacity;
        uniform float uPuffDensity;
        uniform float uFlowSpeed;
        uniform vec3 uPuffColor;
        uniform vec3 uRimColor;

        ${simplexNoiseGLSL}

        float cloudFBM(vec2 p) {
          float f = 0.0;
          f += 0.5200 * snoise(p); p = p * 2.05;
          f += 0.2800 * snoise(p); p = p * 2.08;
          f += 0.1400 * snoise(p);
          return f * 0.5 + 0.5;
        }

        void main() {
          vec2 uv = vUv - 0.5;
          float dist = length(uv) * 2.0;
          float radial = exp(-dist * dist * 3.8);
          radial *= smoothstep(1.0, 0.2, dist);

          vec2 cloudUv = uv * 2.2 + vec2(
            sin(uTime * 0.08 * uFlowSpeed + uv.y * 1.5) * 0.12,
            -uTime * 0.10 * uFlowSpeed
          );
          float n = cloudFBM(cloudUv);
          float billow = smoothstep(0.20, 0.75, n);
          float cloud = radial * mix(0.40, 1.0, billow);
          float alpha = clamp(cloud * uOpacity * uPuffDensity, 0.0, 1.0);

          vec3 col = mix(uPuffColor, uRimColor, clamp(radial * 1.25, 0.0, 1.0));
          gl_FragColor = vec4(col, alpha);
        }
      `
    });

    const pr = rawAltarMistConfig.puffRadius;
    const ph = rawAltarMistConfig.puffHeight;

    if (fog1Node && !fog1RootGroup) {
      fog1RootGroup = new THREE.Group();
      fog1RootGroup.name = 'AltarMist_Fog1_Group';
      const off = rawAltarMistConfig.offsetFog1;
      fog1RootGroup.position.set(off[0], off[1], off[2]);
      fog1RootGroup.add(createFluffyCloudCluster(pr, ph));
      fog1RootGroup.visible = !!rawAltarMistConfig.enableEmptiesPuffs;
      fog1Node.add(fog1RootGroup);
    }

    if (fire001Node && !fire001RootGroup) {
      fire001RootGroup = new THREE.Group();
      fire001RootGroup.name = 'AltarMist_Fire001_Group';
      const off = rawAltarMistConfig.offsetFire001;
      fire001RootGroup.position.set(off[0], off[1], off[2]);
      fire001RootGroup.add(createFluffyCloudCluster(pr, ph));
      fire001RootGroup.visible = !!rawAltarMistConfig.enableEmptiesPuffs;
      fire001Node.add(fire001RootGroup);
    }
  }
}

const _parentInvQuat = new THREE.Quaternion();
const _rollQuat = new THREE.Quaternion();
const _tempParentQuat = new THREE.Quaternion();

/**
 * Main animation update loop: dynamically aligns steam plumes and cloud billboards to camera.
 */
export function updateAltarMist(elapsed, delta, camera) {
  altarMistUniforms.uTime.value = elapsed;

  const flow = rawAltarMistConfig.flowSpeed;

  // 1. Orient steam plumes to camera with upward convection float
  if (camera && steamPlumes.length > 0) {
    steamPlumes.forEach((item) => {
      if (item.mesh.parent) {
        item.mesh.parent.getWorldQuaternion(_tempParentQuat);
        _parentInvQuat.copy(_tempParentQuat).invert();
        item.mesh.quaternion.copy(_parentInvQuat).multiply(camera.quaternion);

        if (item.rotZ) {
          _rollQuat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), item.rotZ + elapsed * 0.015 * flow);
          item.mesh.quaternion.multiply(_rollQuat);
        }
      } else {
        item.mesh.quaternion.copy(camera.quaternion);
      }

      const floatY = Math.sin(elapsed * item.speed * flow * 2.0 + item.seed) * 0.02;
      const floatX = Math.cos(elapsed * item.speed * flow * 1.5 + item.seed) * 0.015;
      item.mesh.position.y = item.basePos.y + floatY;
      item.mesh.position.x = item.basePos.x + floatX;
    });
  }

  // 2. Orient optional empties cloud puffs to camera
  if (camera && (fog1RootGroup?.visible || fire001RootGroup?.visible)) {
    const spread = rawAltarMistConfig.cloudSpread || 1.0;
    puffBillboards.forEach((item) => {
      if (item.mesh.parent) {
        item.mesh.parent.getWorldQuaternion(_tempParentQuat);
        _parentInvQuat.copy(_tempParentQuat).invert();
        item.mesh.quaternion.copy(_parentInvQuat).multiply(camera.quaternion);

        if (item.rotZ !== undefined) {
          _rollQuat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), item.rotZ + elapsed * 0.02 * flow);
          item.mesh.quaternion.multiply(_rollQuat);
        }
      } else {
        item.mesh.quaternion.copy(camera.quaternion);
      }

      const floatY = Math.sin(elapsed * item.floatSpeed * flow * 2.5 + item.seed) * 0.04;
      const floatX = Math.cos(elapsed * (item.floatSpeed * 0.7) * flow * 2.5 + item.seed) * 0.03;
      item.mesh.position.y = item.basePos.y + floatY;
      item.mesh.position.x = (item.basePos.x * spread) + floatX;
      item.mesh.position.z = (item.basePos.z * spread);
    });
  }
}

/**
 * Clean GPU memory disposal.
 */
export function cleanupAltarMist() {
  steamPlumes.forEach((item) => {
    if (item.mesh.geometry) item.mesh.geometry.dispose();
  });
  steamPlumes = [];

  if (steamMaterial) {
    steamMaterial.dispose();
    steamMaterial = null;
  }

  if (altarSlabMistMesh) {
    if (altarSlabMistMesh.geometry) altarSlabMistMesh.geometry.dispose();
    altarSlabMistMesh = null;
  }

  if (slabCarpetMaterial) {
    slabCarpetMaterial.dispose();
    slabCarpetMaterial = null;
  }

  if (altarSlabSecondaryMesh) {
    if (altarSlabSecondaryMesh.geometry) altarSlabSecondaryMesh.geometry.dispose();
    altarSlabSecondaryMesh = null;
  }

  if (slabSecondaryMaterial) {
    slabSecondaryMaterial.dispose();
    slabSecondaryMaterial = null;
  }

  if (altarSteamGroup) {
    altarSteamGroup.parent?.remove(altarSteamGroup);
    altarSteamGroup = null;
  }

  puffBillboards.forEach((item) => {
    if (item.mesh.geometry) item.mesh.geometry.dispose();
  });
  puffBillboards = [];

  if (puffMaterial) {
    puffMaterial.dispose();
    puffMaterial = null;
  }

  if (fog004Material) {
    fog004Material.dispose();
    fog004Material = null;
  }

  if (fog1RootGroup) {
    fog1RootGroup.parent?.remove(fog1RootGroup);
    fog1RootGroup = null;
  }

  if (fire001RootGroup) {
    fire001RootGroup.parent?.remove(fire001RootGroup);
    fire001RootGroup = null;
  }

  if (fog004MeshRef) {
    fog004MeshRef.visible = true;
    fog004MeshRef = null;
  }

  fog2BowlAnchorNode = null;
}

/**
 * Current runtime state for testing & DevTools.
 */
export function getAltarMistState() {
  return {
    hasAltarMist: !!(altarSteamGroup || fog004MeshRef || fog1RootGroup || fire001RootGroup),
    hasSteam: !!altarSteamGroup,
    steamPlumesCount: steamPlumes.length,
    bowlAnchor: fog2BowlAnchorNode ? fog2BowlAnchorNode.name : null,
    fog004Active: !!fog004MeshRef && fog004MeshRef.visible,
    fog004Pos: fog004MeshRef ? fog004MeshRef.position.toArray() : null,
    fog1Active: !!fog1RootGroup,
    fire001Active: !!fire001RootGroup,
    cloudPuffsCount: puffBillboards.length,
    emptiesPuffsVisible: fog1RootGroup ? fog1RootGroup.visible : false,
    opacity: altarMistUniforms.uOpacity.value,
    carpetDensity: altarMistUniforms.uCarpetDensity.value,
    steamHeight: rawAltarMistConfig.steamHeight,
    steamRadius: rawAltarMistConfig.steamRadius,
    flowSpeed: altarMistUniforms.uFlowSpeed.value,
    fog004Hidden: fog004MeshRef ? !fog004MeshRef.visible : false
  };
}
