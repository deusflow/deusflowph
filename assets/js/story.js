/**
 * ============================================================================
 * DEUSFLOW · 3D CINEMATIC STORY ENGINE
 * ============================================================================
 * Architecture:
 * 1. Scene Initialization & GLTF Camera Override
 *    - Uses authored Camera from Story3.glb.
 *    - Completely bypasses Capsule+Octree physics collision loop.
 * 2. Scrollytelling Animation Split Logic (GSAP + Three.js)
 *    - Camera Animation: Strictly scroll-driven via cameraMixer.setTime().
 *    - cameraDuration computed via Math.max across ALL camera tracks.
 *    - Portal Animation (Sketchfab_model): Continuous loop in requestAnimationFrame.
 * 3. Transparent Plane Sorting (Cloud & Fog Artifacts Fix)
 *    - All Bilboard.* and FOG.* planes set to transparent: true, depthWrite: false, alphaTest: 0.01.
 *    - Per-frame billboard orientation: mesh.lookAt(cameraWorldPos).
 * 4. Procedural Fog & Dynamic Twinkling Stars
 *    - Atmospheric THREE.Fog(0x0d0a08, 15, 200).
 *    - Sinusoidal opacity modulation on stars mesh.
 * 5. Full i18n Multilingual Support (UA / EN / DA)
 *    - Dynamic translations for HUD, timecodes, hints, and finale portal card.
 * 6. Resize Handling & Deep Memory Cleanup
 *    - camera.aspect updates & camera.updateProjectionMatrix().
 *    - Full disposal of geometries, materials, textures, and GSAP triggers.
 * ============================================================================
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Timer } from 'three/addons/misc/Timer.js';

// --- i18n Dictionary Definition ---
const STORY_I18N = {
  en: {
    loading: 'Loading cinematic journey...',
    scrollHint: 'SCROLL TO EXPLORE',
    progress: 'PROGRESS //',
    navPortfolio: 'PORTFOLIO →',
    chapters: [
      { p: 0.00, act: 'ACT I // THE THRESHOLD', title: '01 // AWAKENING AT THE CANYON' },
      { p: 0.25, act: 'ACT I // THE THRESHOLD', title: '02 // GLIDING THROUGH THE FOG' },
      { p: 0.50, act: 'ACT II // CELESTIAL SHARDS', title: '03 // AMONG THE LIVING CLOUDS' },
      { p: 0.75, act: 'ACT II // CELESTIAL SHARDS', title: '04 // APPROACHING THE SINGULARITY' },
      { p: 1.00, act: 'ACT III // HORIZON GATE', title: 'EPILOGUE // THE PORTAL CORE' }
    ],
    finale: {
      badge: 'CINEMATIC ODYSSEY',
      title: 'THE PORTAL HORIZON',
      desc: 'You have traversed the celestial canyon. Ahead lie new visual worlds, heartfelt wedding stories, and creative horizons.',
      primaryBtn: 'EXPLORE PORTFOLIO',
      secondaryBtn: 'BACK TO HOME'
    }
  },
  uk: {
    loading: 'Завантаження кінематографічної сцени...',
    scrollHint: 'ГОРТАЙТЕ ДЛЯ ПОДОРОЖІ',
    progress: 'ПРОГРЕС //',
    navPortfolio: 'ПОРТФОЛІО →',
    chapters: [
      { p: 0.00, act: 'АКТ I // ПОРІГ', title: '01 // ПРОБУДЖЕННЯ НАД КАНЬЙОНОМ' },
      { p: 0.25, act: 'АКТ I // ПОРІГ', title: '02 // ПОЛІТ КРІЗЬ ТУМАН' },
      { p: 0.50, act: 'АКТ II // НЕБЕСНІ УЛАМКИ', title: '03 // СЕРЕД ЖИВИХ ХМАР' },
      { p: 0.75, act: 'АКТ II // НЕБЕСНІ УЛАМКИ', title: '04 // НАБЛИЖЕННЯ ДО СИНГУЛЯРНОСТІ' },
      { p: 1.00, act: 'АКТ III // БРАМА ГОРИЗОНТУ', title: 'ЕПІЛОГ // СЕРЦЕ ПОРТАЛУ' }
    ],
    finale: {
      badge: 'КІНЕМАТОГРАФІЧНА ОДІССЕЯ',
      title: 'ГОРИЗОНТ ПОРТАЛУ',
      desc: 'Ви пройшли крізь небесний каньйон. Попереду — сотні історій, щирі весільні кадри та нові творчі горизонти.',
      primaryBtn: 'ПЕРЕЙТИ ДО ПОРТФОЛІО',
      secondaryBtn: 'ГОЛОВНА СТОРІНКА'
    }
  },
  da: {
    loading: 'Indlæser filmisk rejse...',
    scrollHint: 'RUL FOR AT UDFORSKE',
    progress: 'FREMGANG //',
    navPortfolio: 'PORTFOLIO →',
    chapters: [
      { p: 0.00, act: 'AKT I // BEGYNDELSEN', title: '01 // OGVÅGNING VED KLØFTEN' },
      { p: 0.25, act: 'AKT I // BEGYNDELSEN', title: '02 // GLIDENDE GENNEM TÅGEN' },
      { p: 0.50, act: 'AKT II // HIMMELSKE SKÅR', title: '03 // BLANDT DE LEVENDE SKYER' },
      { p: 0.75, act: 'AKT II // HIMMELSKE SKÅR', title: '04 // NÆRMER SIG SINGULARITETEN' },
      { p: 1.00, act: 'AKT III // HORISONTENS PORT', title: 'EPILOG // PORTALENS KERNE' }
    ],
    finale: {
      badge: 'FILMISK ODYSSÉ',
      title: 'PORTALENS HORISONT',
      desc: 'Du har rejst gennem den himmelske kløft. Forude venter nye visuelle verdener, ægte bryllupshistorier og kreative horisonter.',
      primaryBtn: 'UDFORSK PORTFOLIO',
      secondaryBtn: 'TIL FORSIDEN'
    }
  }
};

function getActiveStoryLang() {
  try {
    const params = new URLSearchParams(window.location.search);
    const queryLang = params.get('lang');
    if (queryLang) {
      if (queryLang === 'ua' || queryLang === 'uk') return 'uk';
      if (queryLang === 'da') return 'da';
      if (queryLang === 'en') return 'en';
    }
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/uk/') || path.startsWith('/ua/')) return 'uk';
    if (path.startsWith('/da/')) return 'da';
    const stored = localStorage.getItem('deusflow_lang');
    if (stored === 'uk' || stored === 'ua') return 'uk';
    if (stored === 'da') return 'da';
  } catch (_e) { }
  return 'en';
}

const currentLocale = getActiveStoryLang();
const i18nStrings = STORY_I18N[currentLocale] || STORY_I18N.en;

// --- Scene & Core Variables ---
let scene = null;
let camera = null;
let renderer = null;
const timer = new Timer();
let animationFrameId = null;

// --- Final 1.0 Scroll Redirect Configuration ---
let hasRedirected = false;
const FINAL_REDIRECT_URL = 'PLACEHOLDER_NEXT_PAGE_URL'; // Подставь свой целевой URL (напр. '/portfolio/' или '/#contact')

// --- GLTF Punctual Lights Configuration (KHR_lights_punctual) ---
// Easily fine-tune individual light brightness here without re-exporting the model.
// Clamps massive Blender export values (10,000 - 200,000) down to sane WebGL values (1.0 - 5.0).
export const STORY_LIGHT_CONFIG = {
  'base light to portal': 3.5,
  'contlight2': 200,
  'front light to portal': 3.0,
  'Point': 100,
  'portal l centr': 50
};

const gltfLights = new Map();

/**
 * Resolves configured intensity for a light by name (supporting spaces, underscores, and case insensitivity).
 */
function getLightConfigIntensity(name) {
  if (!name) return null;
  if (STORY_LIGHT_CONFIG[name] !== undefined) return STORY_LIGHT_CONFIG[name];
  const spaced = name.replace(/_/g, ' ').trim();
  if (STORY_LIGHT_CONFIG[spaced] !== undefined) return STORY_LIGHT_CONFIG[spaced];
  const underscored = name.replace(/\s+/g, '_').trim();
  if (STORY_LIGHT_CONFIG[underscored] !== undefined) return STORY_LIGHT_CONFIG[underscored];
  const lower = spaced.toLowerCase();
  for (const [key, val] of Object.entries(STORY_LIGHT_CONFIG)) {
    if (key.toLowerCase().replace(/_/g, ' ').trim() === lower) {
      return val;
    }
  }
  return null;
}

// --- Split Animation Mixers ---
let cameraMixer = null;
let portalMixer = null;
let cameraDuration = 0;
let cameraClipEntries = [];

const billboardMeshes = [];
let starsMesh = null;
const starMeshes = [];
const starUniforms = {
  uTime: { value: 0 }
};
const cameraWorldPos = new THREE.Vector3();
const meshWorldPos = new THREE.Vector3();

// --- GSAP & Scroll State ---
let scrollTriggerInstance = null;
let resizeHandler = null;

// --- DOM Elements ---
const loadingOverlay = document.getElementById('loading-overlay');
const loadingBar = document.getElementById('loading-bar');
const loadingText = document.getElementById('loading-text');
const hudSceneTitle = document.getElementById('hud-scene-title');
const hudTimecode = document.getElementById('hud-timecode');
const hudActLabel = document.getElementById('hud-act-label');
const hudPortfolioLink = document.getElementById('hud-portfolio');
const stepDots = document.querySelectorAll('.step-dot');
const scrollHint = document.getElementById('scroll-hint');
const scrollHintText = document.querySelector('#scroll-hint span');
const finaleCard = document.getElementById('portal-finale-card');

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    applyInitialI18n();
    initStoryEngine();
  });
} else {
  applyInitialI18n();
  initStoryEngine();
}

function applyInitialI18n() {
  if (scrollHintText) scrollHintText.innerText = i18nStrings.scrollHint;
  if (hudPortfolioLink) hudPortfolioLink.querySelector('span').innerText = i18nStrings.navPortfolio;
  if (hudActLabel) hudActLabel.innerText = i18nStrings.chapters[0].act;
  if (hudSceneTitle) hudSceneTitle.innerText = i18nStrings.chapters[0].title;
  if (hudTimecode) hudTimecode.innerText = `${i18nStrings.progress} 0%`;

  if (finaleCard) {
    const badge = finaleCard.querySelector('.finale-badge');
    const title = finaleCard.querySelector('.finale-title');
    const desc = finaleCard.querySelector('.finale-desc');
    const primaryBtn = finaleCard.querySelector('.finale-btn.primary');
    const secondaryBtn = finaleCard.querySelector('.finale-btn.secondary');

    if (badge) badge.innerText = i18nStrings.finale.badge;
    if (title) title.innerText = i18nStrings.finale.title;
    if (desc) desc.innerText = i18nStrings.finale.desc;
    if (primaryBtn) primaryBtn.innerText = i18nStrings.finale.primaryBtn;
    if (secondaryBtn) secondaryBtn.innerText = i18nStrings.finale.secondaryBtn;
  }
}

/**
 * Configuration for star spatial dispersion & line de-clustering
 */
const STAR_DISPERSION_CONFIG = {
  borderCullRate: 0.65,    // Dissolve 65% of stars along Blender's rigid bounding perimeter lines
  interiorDupeRate: 0.45,  // Keep 45% of interior duplicate quads to enrich 3D volume softly
  jitterBorder: 0.65,      // Spatial displacement for perimeter stars
  jitterInterior: 0.32,    // Spatial displacement for interior stars
  depthSpreadZ: 2.2,       // Volumetric 3D canyon depth spread (converts 2D sheet into 3D airspace)
  minScale: 0.50,          // Minimum quad scale (distant pinprick)
  maxScale: 1.35           // Maximum quad scale (radiant jewel)
};

/**
 * Disperses and dilutes rigid linear star rows and stacked duplicate quads:
 * 1. Clones child.geometry so each star mesh instance has independent geometry buffers.
 * 2. Identifies and dissolves the 500 stacked duplicate quads (quads 500..999 were exact twins of 0..499).
 * 3. Thins out the dense rectangular perimeter rows/columns from Blender (X ≈ -5.32, X ≈ 0.13, Y ≈ -3.56, Y ≈ 1.89).
 * 4. Applies quad-preserving 3D pseudo-random spatial displacement (X, Y, and canyon depth Z).
 * 5. Applies astronomical scale variations (delicate pinpricks to radiant jewels).
 */
function disperseStarGeometry(child, meshIndex = 0) {
  if (!child.geometry || !child.geometry.attributes.position) return;

  // Clone geometry so each mesh instance gets independent, unshared vertex buffers
  child.geometry = child.geometry.clone();
  const pos = child.geometry.attributes.position;
  const v = pos.array;
  const quadCount = Math.floor(pos.count / 4);

  // Deterministic pseudo-random hash per quad
  function pHash(seed) {
    const s = Math.sin(seed * 12.9898 + (meshIndex + 1) * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  // Detect whether a quad center lies on the rigid rectangular perimeter from Blender
  function isPerimeter(cx, cy) {
    const onLeft = Math.abs(cx - (-5.317)) < 0.06;
    const onRight = Math.abs(cx - 0.127) < 0.06;
    const onBottom = Math.abs(cy - (-3.556)) < 0.06;
    const onTop = Math.abs(cy - 1.889) < 0.06;
    return onLeft || onRight || onBottom || onTop;
  }

  for (let q = 0; q < quadCount; q++) {
    const baseVertex = q * 4;
    // Compute quad center
    const cx = (v[baseVertex * 3] + v[(baseVertex + 1) * 3] + v[(baseVertex + 2) * 3] + v[(baseVertex + 3) * 3]) * 0.25;
    const cy = (v[baseVertex * 3 + 1] + v[(baseVertex + 1) * 3 + 1] + v[(baseVertex + 2) * 3 + 1] + v[(baseVertex + 3) * 3 + 1]) * 0.25;
    const cz = (v[baseVertex * 3 + 2] + v[(baseVertex + 1) * 3 + 2] + v[(baseVertex + 2) * 3 + 2] + v[(baseVertex + 3) * 3 + 2]) * 0.25;

    const isDuplicateLayer = q >= 500;
    const onBorder = isPerimeter(cx, cy);

    let scale = 1.0;
    let shouldCull = false;

    if (onBorder) {
      // Eliminate duplicate edge quads completely
      if (isDuplicateLayer) {
        shouldCull = true;
      } else {
        // Thin out dense edge line stars so the perimeter fence completely dissolves
        const h = pHash(q * 7.31 + 1.1);
        if (h < STAR_DISPERSION_CONFIG.borderCullRate) {
          shouldCull = true;
        }
      }
    } else if (isDuplicateLayer) {
      // In the interior, keep a portion of duplicate stars to enrich celestial volume without clustering
      const h = pHash(q * 11.17 + 2.3);
      if (h >= STAR_DISPERSION_CONFIG.interiorDupeRate) {
        shouldCull = true;
      }
    }

    if (shouldCull) {
      // Collapse quad to center (0 area) - GPU automatically discards zero-area degenerate triangles
      for (let k = 0; k < 4; k++) {
        const vi = (baseVertex + k) * 3;
        v[vi] = cx;
        v[vi + 1] = cy;
        v[vi + 2] = cz;
      }
      continue;
    }

    // Varied astronomical scale (magnitude): minScale to maxScale
    scale = STAR_DISPERSION_CONFIG.minScale + pHash(q * 33.7 + 5.9) * (STAR_DISPERSION_CONFIG.maxScale - STAR_DISPERSION_CONFIG.minScale);

    // Organic spatial displacement
    // If it was on a border line, give it wider dispersal to break the line cleanly
    const jitterMagnitude = onBorder ? STAR_DISPERSION_CONFIG.jitterBorder : STAR_DISPERSION_CONFIG.jitterInterior;
    const jx = (pHash(q * 17.3 + 3.1) - 0.5) * 2.0 * jitterMagnitude;
    const jy = (pHash(q * 29.7 + 7.4) - 0.5) * 2.0 * jitterMagnitude;
    // 3D canyon depth: transforms flat 2D sheet into a volumetric celestial starfield
    const jz = (pHash(q * 43.1 + 11.8) - 0.5) * STAR_DISPERSION_CONFIG.depthSpreadZ;

    // Apply quad-preserving rigid displacement + center-relative scaling
    for (let k = 0; k < 4; k++) {
      const vi = (baseVertex + k) * 3;
      v[vi]     = cx + (v[vi] - cx) * scale + jx;
      v[vi + 1] = cy + (v[vi + 1] - cy) * scale + jy;
      v[vi + 2] = cz + (v[vi + 2] - cz) * scale + jz;
    }
  }

  pos.needsUpdate = true;
  child.geometry.computeBoundingBox();
  child.geometry.computeBoundingSphere();
}

/**
 * Injects a multi-frequency star scintillation & chromatic iridescence shader.
 * - Every star quad has an independent phase & frequency derived from its 3D coordinates.
 * - Multi-frequency waves: slow atmospheric breathing + air flutter + sharp diamond sparkles.
 * - Chromatic iridescence: shifts dynamically between Hogwarts warm amber, deep burning ember,
 *   subtle celestial sapphire blue-white, and brilliant diamond white at peak glints.
 */
function enhanceStarMaterial(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = starUniforms.uTime;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vStarWorldPos;
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vStarWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vStarWorldPos;
      uniform float uTime;

      // Spatial hash for deterministic per-star phase & scintillation speed
      float starHash(vec3 p) {
        vec3 q = floor(p * 4.5);
        return fract(sin(dot(q, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
      }
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>

      // 1. Independent per-star phase & speed from unique 3D space position
      float sPhase = starHash(vStarWorldPos) * 6.2831853;
      float sFreq = 1.6 + fract(sPhase * 0.17) * 2.8;

      // 2. Multi-frequency organic scintillation:
      // a) Deep slow breathing swell
      float wave1 = sin(uTime * sFreq + sPhase);
      // b) Medium flutter
      float wave2 = sin(uTime * (sFreq * 3.6) + sPhase * 2.3);
      // c) High-frequency needle-sharp glimmers
      float wave3 = sin(uTime * (sFreq * 8.2) + sPhase * 4.9);

      // Normalized scintillation factor [0, 1]
      float rawTwinkle = 0.5 + 0.28 * wave1 + 0.14 * wave2 + 0.08 * wave3;
      // Exponential curve produces sharp celestial diamond glints / sparks
      float twinkle = pow(clamp(rawTwinkle, 0.0, 1.0), 2.2);

      // 3. Chromatic Iridescence / Atmospheric dispersion (переливание цвета):
      vec3 colAmber = vec3(1.0, 0.58, 0.16);  // Warm Hogwarts library gold/amber
      vec3 colWhite = vec3(1.0, 0.98, 0.93);  // Piercing diamond white core
      vec3 colPrism = vec3(0.68, 0.84, 1.0);  // Subtle celestial sapphire blue-white flare
      vec3 colEmber = vec3(1.0, 0.30, 0.05);  // Deep burning ember red-gold

      float colorPhase = sin(uTime * (sFreq * 1.3) + sPhase * 3.1);
      vec3 shimmerCol = mix(colAmber, colEmber, clamp(colorPhase, 0.0, 1.0));
      shimmerCol = mix(shimmerCol, colPrism, clamp(-colorPhase, 0.0, 1.0) * 0.45);
      // Flare up to brilliant diamond white at twinkle peaks
      shimmerCol = mix(shimmerCol, colWhite, smoothstep(0.60, 0.98, twinkle));

      // 4. Emissive radiance modulation
      float starlightIntensity = 1.6 + twinkle * 6.2;
      totalEmissiveRadiance = shimmerCol * starlightIntensity;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      // Modulate transparency dynamically so stars softly glimmer in opacity as well
      gl_FragColor.a *= clamp(0.35 + twinkle * 0.65, 0.0, 1.0);
      `
    );
  };
}

/**
 * ============================================================================
 * PROCEDURAL BLUE FIRE SYSTEM (Goblet of Fire style on fire.001 Empty node)
 * ============================================================================
 * 1. 3D Cross-quad Procedural Flame with ascending multi-octave Simplex noise.
 * 2. Soft camera-facing radial volumetric halo glow.
 * 3. Physical 3D polygonal rising sparks/embers (24 quads, NO gl_PointSize).
 * 4. Dynamic flickering PointLight casting atmospheric blue illumination on rocks.
 */
let blueFireGroup = null;
let blueFireLight = null;
let blueFireHaloMesh = null;
let blueFireSparksMesh = null;
let blueFireMaterial = null;
let flameMeshes = [];
const blueFireUniforms = {
  uTime: { value: 0 }
};
const sparkDummy = new THREE.Object3D();
const SPARK_COUNT = 24;
const sparkData = [];
for (let i = 0; i < SPARK_COUNT; i++) {
  sparkData.push({
    speed: 0.35 + (i % 7) * 0.08,
    offset: (i * 0.137) % 1.0,
    radius: 0.08 + (i % 5) * 0.04,
    angleOffset: (i * 1.256) % (Math.PI * 2),
    baseScale: 0.7 + (i % 4) * 0.15
  });
}

/* ====================================================================
 * НАСТРОЙКИ СИНЕГО ПЛАМЕНИ (FOG2) / BLUE FIRE CONFIGURATION
 * Изменяйте значения прямо в этом объекте (в коде) для сохранения,
 * либо в консоли браузера в реальном времени: BLUE_FIRE_CONFIG.<параметр> = ...
 * ==================================================================== */
const rawBlueFireConfig = {
  // 1. Высота и мощность пламени:
  flameHeight: 0.65,     // Физическая высота языков пламени (было 1.45 — уменьшено, чтобы не било высоко)
  flameWidth: 0.42,      // Ширина пламени у основания
  flamePower: 0.75,      // Мощность / сила вертикальной тяги и длина выброса (0.2 - тихий огонёк, 1.5 - мощный столб)
  flameIntensity: 1.8,   // Накал и свечение шейдера самого огня

  // 2. Общий масштаб и позиционирование:
  scale: [1.0, 1.0, 1.0], // Общий масштаб эффекта [X, Y, Z] или число (масштабирует пламя, искры, ореол и свет!)
  offset: [0, 0, 0],      // Смещение относительно пустышки fog2 [X, Y, Z]

  // 3. Динамический источник света на скалах каньона (PointLight):
  lightIntensity: 2.4,   // Яркость мерцающего света на стенах каньона
  lightDistance: 7.5,    // Радиус освещения стен каньона
  lightDecay: 1.8,       // Скорость затухания света
  lightColor: 0x00c8ff,  // Бирюзово-голубой цвет света

  // 4. Цвета пламени:
  baseColor: new THREE.Color(0x011470), // Глубокий сапфировый низ
  midColor: new THREE.Color(0x00d4ff),  // Бирюзовое тело
  coreColor: new THREE.Color(0xf0fbff)  // Белое ядро накала
};

function applyBlueFireConfig(prop, val) {
  if (prop === 'lightColor' && blueFireLight) {
    blueFireLight.color.set(val);
  } else if (prop === 'lightDistance' && blueFireLight) {
    rawBlueFireConfig.lightDistance = Number(val);
    const avgScale = blueFireGroup ? (blueFireGroup.scale.x + blueFireGroup.scale.y + blueFireGroup.scale.z) / 3 : 1;
    blueFireLight.distance = Number(val) * Math.max(0.001, avgScale);
  } else if (prop === 'lightDecay' && blueFireLight) {
    blueFireLight.decay = Number(val);
  } else if (prop === 'lightIntensity' && blueFireLight) {
    rawBlueFireConfig.lightIntensity = Number(val);
  } else if (prop === 'flameIntensity' && blueFireMaterial && blueFireMaterial.uniforms.uIntensity) {
    blueFireMaterial.uniforms.uIntensity.value = Number(val);
  } else if (prop === 'flamePower' && blueFireMaterial && blueFireMaterial.uniforms.uFlamePower) {
    blueFireMaterial.uniforms.uFlamePower.value = Number(val);
  } else if (prop === 'flameHeight') {
    const h = Number(val);
    rawBlueFireConfig.flameHeight = h;
    flameMeshes.forEach((m) => { m.scale.y = h; });
    if (blueFireHaloMesh) {
      blueFireHaloMesh.scale.y = h * 1.3;
      blueFireHaloMesh.position.y = h * 0.45;
    }
    if (blueFireLight) {
      blueFireLight.position.y = h * 0.4;
    }
  } else if (prop === 'flameWidth') {
    const w = Number(val);
    rawBlueFireConfig.flameWidth = w;
    flameMeshes.forEach((m) => { m.scale.x = w; m.scale.z = w; });
    if (blueFireHaloMesh) {
      blueFireHaloMesh.scale.x = w * 2.2;
    }
  } else if (prop === 'baseColor' && blueFireMaterial && blueFireMaterial.uniforms.uColorBase) {
    if (val instanceof THREE.Color) blueFireMaterial.uniforms.uColorBase.value.copy(val);
    else blueFireMaterial.uniforms.uColorBase.value.set(val);
  } else if (prop === 'midColor' && blueFireMaterial && blueFireMaterial.uniforms.uColorMid) {
    if (val instanceof THREE.Color) blueFireMaterial.uniforms.uColorMid.value.copy(val);
    else blueFireMaterial.uniforms.uColorMid.value.set(val);
  } else if (prop === 'coreColor' && blueFireMaterial && blueFireMaterial.uniforms.uColorCore) {
    if (val instanceof THREE.Color) blueFireMaterial.uniforms.uColorCore.value.copy(val);
    else blueFireMaterial.uniforms.uColorCore.value.set(val);
  } else if (prop === 'scale' && blueFireGroup) {
    let sx = 1, sy = 1, sz = 1;
    if (Array.isArray(val)) {
      sx = Number(val[0]) || 1;
      sy = Number(val[1]) || 1;
      sz = Number(val[2]) || 1;
    } else {
      sx = sy = sz = Number(val) || 1;
    }
    blueFireGroup.scale.set(sx, sy, sz);
    // Scale point light distance proportionally so shrinking to 0.001 visibly scales the light glow too
    if (blueFireLight) {
      const avg = (sx + sy + sz) / 3;
      blueFireLight.distance = (Number(rawBlueFireConfig.lightDistance) || 7.5) * Math.max(0.001, avg);
    }
  } else if (prop === 'offset' && blueFireGroup && Array.isArray(val)) {
    blueFireGroup.position.set(Number(val[0]) || 0, Number(val[1]) || 0, Number(val[2]) || 0);
  }
}

const BLUE_FIRE_CONFIG = new Proxy(rawBlueFireConfig, {
  set(target, prop, val) {
    target[prop] = val;
    applyBlueFireConfig(prop, val);
    return true;
  }
});

function setBlueFireConfig(newConfig = {}) {
  if (!newConfig || typeof newConfig !== 'object') return BLUE_FIRE_CONFIG;
  for (const [key, val] of Object.entries(newConfig)) {
    BLUE_FIRE_CONFIG[key] = val;
  }
  console.log('[StoryEngine] BLUE_FIRE_CONFIG updated live:', BLUE_FIRE_CONFIG);
  return BLUE_FIRE_CONFIG;
}

// Expose directly to window for live editing in DevTools console
if (typeof window !== 'undefined') {
  window.BLUE_FIRE_CONFIG = BLUE_FIRE_CONFIG;
  window.setBlueFireConfig = setBlueFireConfig;
}

function createBlueFireEffect(targetNode) {
  if (!targetNode) return;

  blueFireGroup = new THREE.Group();
  blueFireGroup.name = 'BlueFlameVfx';

  // Apply configurable initial scale and offset
  let sx = 1, sy = 1, sz = 1;
  if (Array.isArray(BLUE_FIRE_CONFIG.scale)) {
    sx = Number(BLUE_FIRE_CONFIG.scale[0]) || 1;
    sy = Number(BLUE_FIRE_CONFIG.scale[1]) || 1;
    sz = Number(BLUE_FIRE_CONFIG.scale[2]) || 1;
  } else if (typeof BLUE_FIRE_CONFIG.scale === 'number') {
    sx = sy = sz = Number(BLUE_FIRE_CONFIG.scale) || 1;
  }
  blueFireGroup.scale.set(sx, sy, sz);

  if (Array.isArray(BLUE_FIRE_CONFIG.offset)) {
    blueFireGroup.position.set(
      Number(BLUE_FIRE_CONFIG.offset[0]) || 0,
      Number(BLUE_FIRE_CONFIG.offset[1]) || 0,
      Number(BLUE_FIRE_CONFIG.offset[2]) || 0
    );
  }

  // 1. 3D Intersecting Flame Planes (3 double-sided planes rotated at 0, 60, 120 deg)
  // Base unit geometry (1.0 x 1.0) anchored at bottom center
  const flameGeom = new THREE.PlaneGeometry(1.0, 1.0, 16, 24);
  flameGeom.translate(0, 0.5, 0);

  const flameMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: blueFireUniforms.uTime,
      uColorBase: { value: BLUE_FIRE_CONFIG.baseColor },
      uColorMid: { value: BLUE_FIRE_CONFIG.midColor },
      uColorCore: { value: BLUE_FIRE_CONFIG.coreColor },
      uIntensity: { value: BLUE_FIRE_CONFIG.flameIntensity },
      uFlamePower: { value: BLUE_FIRE_CONFIG.flamePower }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform float uFlamePower;

      void main() {
        vUv = uv;
        vec3 pos = position;

        // Natural flame wind sway increasing with height (scaled by flamePower)
        float h = clamp(pos.y, 0.0, 1.0);
        float swayX = sin(uTime * 3.8 + pos.y * 2.5) * (0.05 * uFlamePower) * h;
        float swayZ = cos(uTime * 3.1 + pos.y * 2.1) * (0.04 * uFlamePower) * h;
        pos.x += swayX;
        pos.z += swayZ;

        vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uColorBase;
      uniform vec3 uColorMid;
      uniform vec3 uColorCore;
      uniform float uIntensity;
      uniform float uFlamePower;

      // 2D Simplex Noise
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

      void main() {
        vec2 uv = vUv;

        // Upward-ascending multi-octave flame turbulence (speed tied to flamePower)
        float speed = max(0.25, uFlamePower);
        vec2 scroll1 = vec2(uv.x * 2.8, uv.y * 3.4 - uTime * (2.8 * speed));
        vec2 scroll2 = vec2(uv.x * 5.4 + 0.5, uv.y * 6.8 - uTime * (4.4 * speed));
        float n1 = snoise(scroll1);
        float n2 = snoise(scroll2);
        float flameNoise = n1 * 0.65 + n2 * 0.35;

        // Organic flame teardrop silhouette
        float taper = (1.0 - uv.y) * sqrt(clamp(uv.y * 3.8, 0.0, 1.0));
        float dist = abs(uv.x - 0.5) * 2.0;

        float shape = smoothstep(taper, taper * 0.18, dist - flameNoise * 0.38 * (1.0 - uv.y * 0.45));
        // Soft base fade
        shape *= smoothstep(0.0, 0.12, uv.y);
        // Vertical reach / flame stream power cutoff:
        float tipReach = clamp(0.40 + 0.45 * uFlamePower, 0.25, 0.98);
        shape *= smoothstep(tipReach, tipReach - 0.22, uv.y);

        if (shape <= 0.001) discard;

        // Color mapping: sapphire base -> cyan body -> diamond white core
        float coreMask = pow(clamp(shape, 0.0, 1.0), 2.2);
        vec3 col = mix(uColorBase, uColorMid, smoothstep(0.12, 0.55, shape));
        col = mix(col, uColorCore, smoothstep(0.65, 0.95, coreMask));

        float flicker = 0.88 + 0.12 * sin(uTime * 14.0 + uv.y * 4.0);
        vec3 finalColor = col * uIntensity * flicker;

        gl_FragColor = vec4(finalColor, shape * 0.92);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });

  blueFireMaterial = flameMat;
  flameMeshes = [];

  const angles = [0, Math.PI / 3, (Math.PI * 2) / 3];
  angles.forEach((ang) => {
    const mesh = new THREE.Mesh(flameGeom, flameMat);
    mesh.rotation.y = ang;
    mesh.scale.set(BLUE_FIRE_CONFIG.flameWidth, BLUE_FIRE_CONFIG.flameHeight, BLUE_FIRE_CONFIG.flameWidth);
    mesh.renderOrder = 4;
    blueFireGroup.add(mesh);
    flameMeshes.push(mesh);
  });

  // 2. Soft Volumetric Radial Halo (Billboard)
  const haloGeom = new THREE.PlaneGeometry(1.0, 1.0);
  const haloMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: blueFireUniforms.uTime
    },
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
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float glow = exp(-3.2 * r * r);
        vec3 haloCol = mix(vec3(0.0, 0.82, 1.0), vec3(0.02, 0.22, 0.85), r);
        float pulse = 0.38 + 0.08 * sin(uTime * 7.5);
        gl_FragColor = vec4(haloCol * pulse * 1.5, glow * pulse);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  blueFireHaloMesh = new THREE.Mesh(haloGeom, haloMat);
  blueFireHaloMesh.scale.set(BLUE_FIRE_CONFIG.flameWidth * 2.2, BLUE_FIRE_CONFIG.flameHeight * 1.3, 1.0);
  blueFireHaloMesh.position.set(0, BLUE_FIRE_CONFIG.flameHeight * 0.45, 0);
  blueFireHaloMesh.renderOrder = 4;
  blueFireGroup.add(blueFireHaloMesh);

  // 3. Physical 3D Polygonal Rising Sparks (Quads, NO gl_PointSize)
  const sparkGeom = new THREE.PlaneGeometry(0.038, 0.038);
  const sparkMat = new THREE.MeshBasicMaterial({
    color: 0x88eeff,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  blueFireSparksMesh = new THREE.InstancedMesh(sparkGeom, sparkMat, SPARK_COUNT);
  blueFireSparksMesh.renderOrder = 5;
  blueFireGroup.add(blueFireSparksMesh);

  // 4. Local Dynamic Light for Illuminating Canyon Rock Walls
  const initAvgScale = (blueFireGroup.scale.x + blueFireGroup.scale.y + blueFireGroup.scale.z) / 3;
  blueFireLight = new THREE.PointLight(
    BLUE_FIRE_CONFIG.lightColor,
    BLUE_FIRE_CONFIG.lightIntensity,
    BLUE_FIRE_CONFIG.lightDistance * Math.max(0.001, initAvgScale),
    BLUE_FIRE_CONFIG.lightDecay
  );
  blueFireLight.position.set(0, BLUE_FIRE_CONFIG.flameHeight * 0.4, 0.1);
  blueFireGroup.add(blueFireLight);

  // Attach to Blender empty node
  targetNode.add(blueFireGroup);
  console.log(`[StoryEngine] Procedural Blue Fire attached to node "${targetNode.name}" at [${targetNode.position.x.toFixed(2)}, ${targetNode.position.y.toFixed(2)}, ${targetNode.position.z.toFixed(2)}]`);
}

function updateBlueFire(time, cam) {
  if (!blueFireGroup) return;

  blueFireUniforms.uTime.value = time;

  // 1. Dynamic light flicker & live config sync
  if (blueFireLight) {
    const avgScale = (blueFireGroup.scale.x + blueFireGroup.scale.y + blueFireGroup.scale.z) / 3;
    blueFireLight.color.set(BLUE_FIRE_CONFIG.lightColor);
    blueFireLight.distance = (Number(rawBlueFireConfig.lightDistance) || 7.5) * Math.max(0.001, avgScale);
    blueFireLight.decay = BLUE_FIRE_CONFIG.lightDecay;
    blueFireLight.intensity = BLUE_FIRE_CONFIG.lightIntensity * (0.85 + 0.15 * Math.sin(time * 12.0) + 0.08 * Math.sin(time * 23.5));
  }

  // 2. Halo billboard orientation towards camera
  if (blueFireHaloMesh && cam) {
    blueFireHaloMesh.quaternion.copy(cam.quaternion);
  }

  // 3. Update rising 3D polygonal sparks (height tied to flameHeight and flamePower)
  if (blueFireSparksMesh && cam) {
    const currentH = (Number(rawBlueFireConfig.flameHeight) || 0.65) * (Number(rawBlueFireConfig.flamePower) || 0.75);
    for (let i = 0; i < SPARK_COUNT; i++) {
      const data = sparkData[i];
      const p = ((time * data.speed + data.offset) % 1.0);
      const y = p * currentH * 1.35;
      const angle = time * 2.2 + data.angleOffset;
      const r = data.radius * (0.3 + p * 0.7);
      const x = Math.sin(angle) * r;
      const z = Math.cos(angle) * r;

      sparkDummy.position.set(x, y, z);
      sparkDummy.quaternion.copy(cam.quaternion);

      // Fade/shrink near top and near bottom
      const scaleFade = Math.sin(p * Math.PI) * data.baseScale;
      sparkDummy.scale.setScalar(Math.max(0.001, scaleFade));
      sparkDummy.updateMatrix();

      blueFireSparksMesh.setMatrixAt(i, sparkDummy.matrix);
    }
    blueFireSparksMesh.instanceMatrix.needsUpdate = true;
  }
}

async function initStoryEngine() {
  const canvas = document.getElementById('webgl-canvas');
  if (!canvas) {
    console.error('[StoryEngine] WebGL canvas not found!');
    return;
  }

  // 1. SETUP SCENE, LIGHTING & PROCEDURAL FOG (Requirement 4)
  scene = new THREE.Scene();

  // Dark amber / Hogwarts library night atmosphere
  const fogColor = new THREE.Color(0x0d0a08);
  scene.background = fogColor;
  scene.fog = new THREE.Fog(fogColor, 15, 200);

  // Calibrated lighting: place_WEB and rock_WEB are unlit (MeshBasicMaterial)
  // AmbientLight provides gentle base illumination for standard portal parts
  const ambientLight = new THREE.AmbientLight(0xffedd8, 0.85);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffe2c0, 0.7);
  keyLight.position.set(-15, 35, 20);
  scene.add(keyLight);

  // 2. RENDERER SETUP
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0; // Clean 1.0 exposure to prevent blown-out baked textures
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // 3. LOAD STORY3.GLB WITH PROGRESS
  const loader = new GLTFLoader();

  loader.load(
    '/assets/models/Story3.glb',
    (gltf) => {
      const root = gltf.scene;
      scene.add(root);

      // ======================================================================
      // REQUIREMENT 1: EXTRACT GLTF CAMERA (No default camera instantiated)
      // ======================================================================
      let extractedCamera = gltf.cameras.find((c) => c.name === 'Camera');

      if (!extractedCamera) {
        root.traverse((node) => {
          if (node.isCamera && (node.name === 'Camera' || !extractedCamera)) {
            extractedCamera = node;
          }
        });
      }

      if (!extractedCamera) {
        console.warn('[StoryEngine] Camera named "Camera" not found in GLTF, using fallback.');
        extractedCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        scene.add(extractedCamera);
      }

      camera = extractedCamera;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      // ======================================================================
      // ARCHITECTURAL DIRECTIVE: CAPSULE + OCTREE COLLISION BYPASS
      // ======================================================================
      // In this cinematic scrollytelling sequence:
      // Capsule collision, Octree intersections, and physics updates are 
      // 100% BYPASSED. The camera is driven exclusively by the baked GLTF 
      // keyframes via cameraMixer.setTime().
      // ======================================================================

      // ======================================================================
      // REQUIREMENT 2: ANIMATION SPLIT LOGIC (GSAP + Three.js)
      // ======================================================================
      // REQUIREMENT 2: ANIMATION SPLIT LOGIC (GSAP vs RAF Autoplay)
      // ALL animation clips (Camera, Clouds, and any other baked movement)
      // are assigned to the scroll-driven GSAP mixer (mixer.setTime()).
      // The ONLY animation in continuous autoplay loop (RAF) is Sketchfab_model (the portal).
      // ======================================================================
      const scrollClips = [];
      const portalClips = [];

      // Identify the portal root node and all its descendant node names
      const portalNode = root.getObjectByName('Sketchfab_model') || root.getObjectByName('portal');
      const portalNodeNames = new Set();
      if (portalNode) {
        portalNode.traverse((obj) => {
          if (obj.name) portalNodeNames.add(obj.name.toLowerCase());
        });
      }

      function isPortalAnimation(clip) {
        const nameLower = clip.name.toLowerCase();
        // Explicit name match
        if (nameLower.includes('sketchfab') || nameLower.includes('portal')) return true;
        // Target match: check if tracks target Sketchfab_model hierarchy
        if (portalNodeNames.size > 0) {
          const targetsPortal = clip.tracks.some((track) => {
            const trackTargetName = track.name.split('.')[0].toLowerCase();
            return portalNodeNames.has(trackTargetName);
          });
          if (targetsPortal) return true;
        }
        // Fallback for default Sketchfab export take
        return nameLower.includes('take 001');
      }

      gltf.animations.forEach((clip) => {
        if (isPortalAnimation(clip)) {
          portalClips.push(clip);
        } else {
          scrollClips.push(clip);
        }
      });

      console.log(`[StoryEngine] Animations sorted: ${scrollClips.length} scroll-driven clips (${scrollClips.map(c => c.name).join(', ')}), ${portalClips.length} continuous portal clips (${portalClips.map(c => c.name).join(', ')})`);

      // A) Scroll-driven Mixer: GSAP ScrollTrigger drives Camera, Clouds, and all scene movement
      cameraClipEntries = [];
      if (scrollClips.length > 0) {
        // Master timeline duration across all scroll-driven clips
        cameraDuration = scrollClips.reduce((max, clip) => Math.max(max, clip.duration), 0);

        scrollClips.forEach((clip) => {
          // Extend clip duration to master timeline so Three.js LoopOnce doesn't prematurely clamp/reset
          clip.duration = Math.max(clip.duration, cameraDuration);

          const mixer = new THREE.AnimationMixer(root);
          const action = mixer.clipAction(clip);
          action.clampWhenFinished = true;
          action.setLoop(THREE.LoopOnce);
          action.play();
          cameraClipEntries.push({ mixer, action, clip });
        });

        cameraMixer = cameraClipEntries[0]?.mixer || null;

        initScrollInteraction();
      }

      // B) Portal Mixer: ONLY Sketchfab_model (the portal) in continuous autoplay loop
      if (portalClips.length > 0) {
        portalMixer = new THREE.AnimationMixer(portalNode || root);

        portalClips.forEach((clip) => {
          const action = portalMixer.clipAction(clip);
          action.setLoop(THREE.LoopRepeat);
          action.play();
        });
      }

      // ======================================================================
      // REQUIREMENT 3: TRANSPARENT PLANE SORTING & BILLBOARDS FIX
      // ======================================================================
      billboardMeshes.length = 0;
      gltfLights.clear();
      let fireTargetNode = null;

      root.traverse((child) => {
        // PUNCTUAL LIGHTS SCALING: detect GLTF punctual lights and scale down massive raw values
        if (child.isLight) {
          const configIntensity = getLightConfigIntensity(child.name) ?? (child.parent ? getLightConfigIntensity(child.parent.name) : null);
          const rawIntensity = child.intensity;
          if (configIntensity !== null) {
            child.intensity = configIntensity;
          } else if (child.intensity > 10) {
            // Safe clamp / remap fallback for any unconfigured punctual light (clamps to 1.0 - 5.0)
            child.intensity = THREE.MathUtils.clamp(child.intensity / 2500, 1.0, 5.0);
          }
          gltfLights.set(child.name, child);
          console.log(`[StoryEngine] Scaled punctual light "${child.name}" (${child.type}): raw ${rawIntensity.toFixed(1)} -> scaled ${child.intensity.toFixed(2)}`);
        }

        // Identify target empty node for Procedural Blue Fire (prioritizing fog2, fallback to fire001)
        if (child.name === 'fog2' || child.name.toLowerCase() === 'fog2') {
          fireTargetNode = child;
        } else if (!fireTargetNode && (child.name === 'fire001' || child.name === 'fire.001')) {
          fireTargetNode = child;
        }

        if (child.isMesh) {
          // UNLIT FIX for Cloud_Poly and Sky: emissive=[1,1,1] in GLTF causes blowout under scene lights.
          // Convert to THREE.MeshBasicMaterial (copying map and color) to make them completely unlit.
          if (child.name === 'Cloud_Poly' || child.name === 'Sky') {
            const oldMat = child.material;
            const tex = oldMat.map || oldMat.emissiveMap;
            const col = (oldMat.color && (oldMat.color.r > 0 || oldMat.color.g > 0 || oldMat.color.b > 0))
              ? oldMat.color.clone()
              : (oldMat.emissive ? oldMat.emissive.clone() : new THREE.Color(0xffffff));

            child.material = new THREE.MeshBasicMaterial({
              map: tex,
              color: col,
              side: oldMat.side || THREE.DoubleSide,
              transparent: oldMat.transparent || false,
              opacity: oldMat.opacity !== undefined ? oldMat.opacity : 1.0,
              depthWrite: oldMat.depthWrite !== undefined ? oldMat.depthWrite : true
            });
            child.material.needsUpdate = true;
            if (oldMat.dispose) oldMat.dispose();
          }

          const isBillboard = child.name.startsWith('Bilboard');
          const isGroundFog = child.name.startsWith('FOG') || child.name.toLowerCase().includes('fog');

          if (isBillboard) {
            billboardMeshes.push(child);

            // Layered density distribution: ~43% of billboards become soft, airy misty halos
            const num = parseInt(child.name.replace(/\D/g, ''), 10) || 0;
            const isMistLayer = (num % 3 === 0 || num % 7 === 0);

            if (isMistLayer) {
              // Clone material so mist opacity does not affect dense shared cloud materials
              child.material = Array.isArray(child.material)
                ? child.material.map((m) => m.clone())
                : child.material.clone();

              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach((mat) => {
                mat.transparent = true;
                mat.depthWrite = false;
                mat.alphaTest = 0.001; // Buttery soft gradient edges without dither cutouts
                mat.side = THREE.DoubleSide;
                mat.opacity = 0.44;     // Delicate, luminous atmospheric mist
                mat.needsUpdate = true;
              });

              child.userData.baseOpacity = 0.44;
              child.userData.isMist = true;
              // Expand slightly (+18%) to form an enveloping misty halo around cloud cores
              child.scale.multiplyScalar(1.18);
              child.renderOrder = 3;
            } else {
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach((mat) => {
                mat.transparent = true;
                mat.depthWrite = false;
                mat.alphaTest = 0.01;
                mat.side = THREE.DoubleSide;
                mat.opacity = 0.95;     // Dense cloud core
                mat.needsUpdate = true;
              });

              child.userData.baseOpacity = 0.95;
              child.userData.isMist = false;
              child.renderOrder = 2;
            }
          } else if (isGroundFog) {
            // Ground Fog (M_BottomFog): static horizontal fog layer, do NOT add to billboardMeshes (NO lookAt)!
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat) => {
              mat.transparent = true;
              mat.depthWrite = false;
              mat.alphaTest = 0.01;
              mat.side = THREE.DoubleSide;
              mat.needsUpdate = true;
            });

            child.renderOrder = 2;
          }

          // REQUIREMENT 4: Grab Stars Meshes for Twinkling & Chromatic Scintillation
          if (child.name.toLowerCase() === 'stars' || child.name.toLowerCase().includes('star')) {
            starsMesh = child;
            const starMeshIndex = starMeshes.length;
            starMeshes.push(child);

            // Disperse Blender's rigid linear grid rows & deduplicate stacked quads
            disperseStarGeometry(child, starMeshIndex);

            const starMaterials = Array.isArray(child.material) ? child.material : [child.material];
            starMaterials.forEach((mat) => {
              mat.transparent = true;
              mat.depthWrite = false;
              mat.needsUpdate = true;

              // Inject celestial scintillation & chromatic iridescence shader
              if (!mat.userData.hasStarShader) {
                mat.userData.hasStarShader = true;
                enhanceStarMaterial(mat);
              }
            });
            child.renderOrder = 3;
          }
        }
      });

      // Attach Procedural Blue Fire to fire.001 empty node once traversal is complete
      if (fireTargetNode) {
        createBlueFireEffect(fireTargetNode);
      }

      // REQUIREMENT 5: Window Resize Listener
      resizeHandler = onWindowResize;
      window.addEventListener('resize', resizeHandler);

      // Set initial frame (start of cinematic track)
      setCameraScrollProgress(0);

      // Expose debug state for verification testing
      window.__STORY_STATE__ = {
        cameraLoaded: !!camera,
        cameraName: camera ? camera.name : null,
        cameraDuration,
        cameraClipsCount: scrollClips.length,
        ambientClipsCount: portalClips.length,
        scrollClipsCount: scrollClips.length,
        portalClipsCount: portalClips.length,
        billboardCount: billboardMeshes.length,
        mistCloudCount: billboardMeshes.filter((m) => m.userData.isMist).length,
        denseCloudCount: billboardMeshes.filter((m) => !m.userData.isMist).length,
        hasStars: starMeshes.length > 0 || !!starsMesh,
        starsCount: starMeshes.length,
        hasBlueFire: !!blueFireGroup,
        blueFireNodeName: blueFireGroup?.parent?.name || null,
        blueFirePos: blueFireGroup?.parent?.position ? [blueFireGroup.parent.position.x, blueFireGroup.parent.position.y, blueFireGroup.parent.position.z] : null,
        blueFireIntensity: blueFireLight ? blueFireLight.intensity : 0,
        blueFireConfig: BLUE_FIRE_CONFIG,
        setBlueFireConfig,
        setScrollProgress: (progress) => {
          setCameraScrollProgress(progress);
        },
        getCameraPosition: () => camera ? { x: camera.position.x, y: camera.position.y, z: camera.position.z } : null,
        getStarDispersionStats: () => {
          return starMeshes.map((m) => {
            const pos = m.geometry.attributes.position;
            const v = pos.array;
            let activeQuads = 0;
            let culledQuads = 0;
            const activeCenters = [];

            for (let i = 0; i < pos.count; i += 4) {
              const p0x = v[i * 3];
              const p1x = v[(i + 1) * 3];
              const p0y = v[i * 3 + 1];
              const p1y = v[(i + 1) * 3 + 1];
              const isCulled = Math.abs(p0x - p1x) < 1e-6 && Math.abs(p0y - p1y) < 1e-6;
              if (isCulled) {
                culledQuads++;
              } else {
                activeQuads++;
                const cx = (v[i * 3] + v[(i + 1) * 3] + v[(i + 2) * 3] + v[(i + 3) * 3]) * 0.25;
                const cy = (v[i * 3 + 1] + v[(i + 1) * 3 + 1] + v[(i + 2) * 3 + 1] + v[(i + 3) * 3 + 1]) * 0.25;
                const cz = (v[i * 3 + 2] + v[(i + 1) * 3 + 2] + v[(i + 2) * 3 + 2] + v[(i + 3) * 3 + 2]) * 0.25;
                activeCenters.push([cx, cy, cz]);
              }
            }

            const xMap = new Map();
            const yMap = new Map();
            activeCenters.forEach((pt) => {
              const kx = pt[0].toFixed(2);
              const ky = pt[1].toFixed(2);
              xMap.set(kx, (xMap.get(kx) || 0) + 1);
              yMap.set(ky, (yMap.get(ky) || 0) + 1);
            });

            const maxColStars = Math.max(0, ...Array.from(xMap.values()));
            const maxRowStars = Math.max(0, ...Array.from(yMap.values()));
            const bb = m.geometry.boundingBox;
            const depthSpreadZ = bb ? (bb.max.z - bb.min.z) : 0;

            return {
              meshName: m.name,
              totalQuads: Math.floor(pos.count / 4),
              activeQuads,
              culledQuads,
              maxColStars,
              maxRowStars,
              depthSpreadZ,
              isDispersed: maxColStars <= 6 && maxRowStars <= 6 && depthSpreadZ > 1.5
            };
          });
        },
        getStarGeometryDetails: () => {
          return starMeshes.map((m) => {
            if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
            const pos = m.geometry.attributes.position;
            const idx = m.geometry.index;
            return {
              name: m.name,
              vertexCount: pos.count,
              indexCount: idx ? idx.count : 0,
              bounds: {
                min: [m.geometry.boundingBox.min.x, m.geometry.boundingBox.min.y, m.geometry.boundingBox.min.z],
                max: [m.geometry.boundingBox.max.x, m.geometry.boundingBox.max.y, m.geometry.boundingBox.max.z]
              },
              firstVertices: [
                [pos.getX(0), pos.getY(0), pos.getZ(0)],
                [pos.getX(1), pos.getY(1), pos.getZ(1)],
                [pos.getX(2), pos.getY(2), pos.getZ(2)],
                [pos.getX(3), pos.getY(3), pos.getZ(3)],
                [pos.getX(4), pos.getY(4), pos.getZ(4)],
                [pos.getX(5), pos.getY(5), pos.getZ(5)],
                [pos.getX(6), pos.getY(6), pos.getZ(6)],
                [pos.getX(7), pos.getY(7), pos.getZ(7)]
              ],
              firstIndices: idx ? Array.from(idx.array.slice(0, 18)) : null
            };
          });
        },
        getStarQuadCenters: (meshIdx = 0) => {
          const m = starMeshes[meshIdx];
          if (!m) return [];
          const pos = m.geometry.attributes.position;
          const centers = [];
          for (let i = 0; i < pos.count; i += 4) {
            const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2) + pos.getX(i + 3)) * 0.25;
            const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2) + pos.getY(i + 3)) * 0.25;
            const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2) + pos.getZ(i + 3)) * 0.25;
            centers.push([cx, cy, cz]);
          }
          return centers;
        },
        getQuadVertices: (meshIdx = 0, quadIdx = 0) => {
          const m = starMeshes[meshIdx];
          if (!m) return [];
          const pos = m.geometry.attributes.position;
          const start = quadIdx * 4;
          return [
            [pos.getX(start), pos.getY(start), pos.getZ(start)],
            [pos.getX(start + 1), pos.getY(start + 1), pos.getZ(start + 1)],
            [pos.getX(start + 2), pos.getY(start + 2), pos.getZ(start + 2)],
            [pos.getX(start + 3), pos.getY(start + 3), pos.getZ(start + 3)]
          ];
        },
        getAllObjects: (filter) => {
          const res = [];
          scene?.traverse((c) => {
            if (!filter || c.name.toLowerCase().includes(filter.toLowerCase())) {
              res.push({
                name: c.name,
                type: c.type,
                isMesh: !!c.isMesh,
                visible: c.visible,
                position: [c.position.x, c.position.y, c.position.z],
                scale: [c.scale.x, c.scale.y, c.scale.z],
                parentName: c.parent?.name,
                materialName: c.material?.name,
                materialType: c.material?.type
              });
            }
          });
          return res;
        },
        getMeshMaterialInfo: (name) => {
          let found = null;
          scene?.traverse((c) => {
            if (c.name === name) {
              found = {
                name: c.name,
                materialType: c.material?.type,
                isMeshBasicMaterial: c.material?.isMeshBasicMaterial === true,
                hasMap: !!c.material?.map,
                color: c.material?.color ? c.material.color.toArray() : null
              };
            }
          });
          return found;
        },
        getLightsInfo: () => {
          const list = [];
          gltfLights.forEach((light, name) => {
            list.push({
              name,
              type: light.type,
              intensity: light.intensity,
              color: light.color.getHexString()
            });
          });
          return list;
        },
        setLightIntensity: (name, intensity) => {
          const light = gltfLights.get(name) || gltfLights.get(name.replace(/\s+/g, '_')) || gltfLights.get(name.replace(/_/g, ' '));
          if (light) {
            light.intensity = intensity;
            console.log(`[StoryEngine] Light "${name}" intensity dynamically updated to ${intensity}`);
            return true;
          }
          return false;
        }
      };

      // Hide loading screen
      hideLoadingOverlay();

      // Start render loop
      animate();
    },
    (event) => {
      if (event.total > 0) {
        const progress = Math.round((event.loaded / event.total) * 100);
        if (loadingBar) loadingBar.style.width = `${progress}%`;
        if (loadingText) loadingText.innerText = `${i18nStrings.loading} ${progress}%`;
      }
    },
    (err) => {
      console.error('[StoryEngine] Failed to load Story3.glb:', err);
      if (loadingText) loadingText.innerText = 'Error loading 3D scene';
    }
  );
}

/**
 * Scrubs camera animation clips safely based on normalized scroll progress [0, 1].
 * Clamps playback time to prevent Three.js LoopOnce overflow/reset at 100%.
 */
function setCameraScrollProgress(progress) {
  const p = Math.max(0, Math.min(1, progress));
  if (cameraClipEntries.length > 0) {
    cameraClipEntries.forEach(({ mixer, action, clip }) => {
      action.paused = false;
      const targetTime = Math.min(p * clip.duration, Math.max(0, clip.duration - 0.0001));
      mixer.setTime(targetTime);
    });
  } else if (cameraMixer && cameraDuration > 0) {
    const targetTime = Math.min(p * cameraDuration, Math.max(0, cameraDuration - 0.0001));
    cameraMixer.setTime(targetTime);
  }
}

/**
 * Binds camera animation scrub and HUD updates to GSAP ScrollTrigger.
 */
function initScrollInteraction() {
  if (typeof window === 'undefined' || !window.ScrollTrigger) {
    console.warn('[StoryEngine] ScrollTrigger is not available.');
    return;
  }

  const scrollWrapper = document.querySelector('.scroll-wrapper') || document.body;

  scrollTriggerInstance = window.ScrollTrigger.create({
    trigger: scrollWrapper,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.2, // Premium cinematic inertial scrub
    onUpdate: (self) => {
      const progress = self.progress;

      // 1. Scrub Camera Animation
      setCameraScrollProgress(progress);

      // 2. Hide Scroll Prompt on first scroll
      if (scrollHint) {
        if (progress > 0.02) {
          scrollHint.classList.add('hidden');
        } else {
          scrollHint.classList.remove('hidden');
        }
      }

      // 3. Update HUD Chapter & Timecode
      updateHUD(progress);

      // 4. Reveal Finale Portal Card at the end of track
      if (finaleCard) {
        if (progress > 0.94) {
          finaleCard.classList.add('visible');
        } else {
          finaleCard.classList.remove('visible');
        }
      }

      // 5. Final Idempotent Redirect at 100% Scroll
      if (progress >= 0.999 && !hasRedirected) {
        hasRedirected = true;
        const fadeOverlay = document.getElementById('fade-overlay');
        if (fadeOverlay) {
          fadeOverlay.classList.add('active');
        }
        setTimeout(() => {
          window.location.href = FINAL_REDIRECT_URL;
        }, 800);
      }
    }
  });

  // Allow clicking on stepper dots to smoothly scroll to corresponding milestone
  stepDots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      const targetP = i18nStrings.chapters[index] ? i18nStrings.chapters[index].p : index / (stepDots.length - 1);
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({
        top: targetP * maxScroll,
        behavior: 'smooth'
      });
    });
  });
}

/**
 * Updates HUD chapter name, progress percentage, and step indicator dots.
 */
function updateHUD(progress) {
  const chaptersList = i18nStrings.chapters;
  let currentChapter = chaptersList[0];
  let currentIdx = 0;
  for (let i = chaptersList.length - 1; i >= 0; i--) {
    if (progress >= chaptersList[i].p - 0.05) {
      currentChapter = chaptersList[i];
      currentIdx = i;
      break;
    }
  }

  const pct = Math.round(progress * 100);

  if (hudSceneTitle) hudSceneTitle.innerText = currentChapter.title;
  if (hudActLabel) hudActLabel.innerText = currentChapter.act;
  if (hudTimecode) hudTimecode.innerText = `${i18nStrings.progress} ${pct}%`;

  stepDots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === currentIdx);
  });
}

/**
 * Smoothly hides the initial loading screen.
 */
function hideLoadingOverlay() {
  if (loadingOverlay) {
    loadingOverlay.classList.add('fade-out');
    setTimeout(() => {
      loadingOverlay.style.display = 'none';
    }, 850);
  }
}

/**
 * Main Render & Animation Loop (60/120 FPS).
 */
function animate() {
  animationFrameId = requestAnimationFrame(animate);

  // Requirement 4: Timer protects portalMixer against delta spikes when tab is hidden
  timer.update();
  const delta = timer.getDelta();

  // ==========================================================================
  // [COLLISION BYPASS]: Physics / Capsule+Octree are completely omitted here.
  // The camera follows the baked GLTF trajectory without obstacle conflicts.
  // ==========================================================================

  // 1. Ambient Portal Animation (Loops continuously regardless of scroll pause)
  if (portalMixer) {
    portalMixer.update(delta);
  }

  // 2. Orient all Bilboard planes towards camera & calculate smooth camera near-dissolve
  if (camera && billboardMeshes.length > 0) {
    camera.getWorldPosition(cameraWorldPos);
    for (let i = 0; i < billboardMeshes.length; i++) {
      const mesh = billboardMeshes[i];
      mesh.lookAt(cameraWorldPos);

      // Camera distance near-fade: dissolves billboards gently when camera flies in close
      // Prevents 2D flat plane clipping artifacts across the near clipping plane
      const baseOp = mesh.userData.baseOpacity ?? 1.0;
      mesh.getWorldPosition(meshWorldPos);
      const distToCam = cameraWorldPos.distanceTo(meshWorldPos);

      const nearFadeDistance = 2.5;
      const minClipDistance = 0.8;
      if (distToCam < nearFadeDistance) {
        const factor = Math.max(0, Math.min(1, (distToCam - minClipDistance) / (nearFadeDistance - minClipDistance)));
        const targetOpacity = baseOp * factor;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => { m.opacity = targetOpacity; });
        } else if (mesh.material) {
          mesh.material.opacity = targetOpacity;
        }
      } else {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => { m.opacity = baseOp; });
        } else if (mesh.material && mesh.material.opacity !== baseOp) {
          mesh.material.opacity = baseOp;
        }
      }
    }
  }

  // 3. Dynamic Celestial Stars Scintillation & Chromatic Shimmer
  if (starMeshes.length > 0) {
    starUniforms.uTime.value = (typeof timer !== 'undefined' && timer.getElapsed)
      ? timer.getElapsed()
      : performance.now() * 0.001;
  } else if (starsMesh && starsMesh.material) {
    const starSpeed = 0.0035;
    const opacity = 0.58 + Math.sin(Date.now() * starSpeed) * 0.38;
    if (Array.isArray(starsMesh.material)) {
      starsMesh.material.forEach((mat) => { mat.opacity = opacity; });
    } else {
      starsMesh.material.opacity = opacity;
    }
  }

  // 4. Update Procedural Blue Fire Effect (Flame, sparks, halo & light flicker)
  const elapsedFireSec = (timer && timer.getElapsed)
    ? timer.getElapsed()
    : performance.now() * 0.001;
  updateBlueFire(elapsedFireSec, camera);

  // 5. Render Scene with extracted GLTF Camera
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

/**
 * Responsive Window Resize Handler.
 */
function onWindowResize() {
  if (!camera || !renderer) return;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

/**
 * Deep Cleanup & Unmount function to prevent SPA memory leaks.
 */
export function cleanup() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (scrollTriggerInstance) {
    scrollTriggerInstance.kill();
    scrollTriggerInstance = null;
  }

  if (cameraMixer) {
    cameraMixer.stopAllAction();
    cameraMixer.uncacheRoot(cameraMixer.getRoot());
    cameraMixer = null;
  }

  if (portalMixer) {
    portalMixer.stopAllAction();
    portalMixer.uncacheRoot(portalMixer.getRoot());
    portalMixer = null;
  }

  if (scene) {
    scene.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        mats.forEach((mat) => {
          for (const key of Object.keys(mat)) {
            const val = mat[key];
            if (val && typeof val === 'object' && 'dispose' in val && typeof val.dispose === 'function') {
              val.dispose();
            }
          }
          mat.dispose();
        });
      }
    });

    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }
    scene = null;
  }

  if (renderer) {
    renderer.dispose();
    renderer = null;
  }

  if (blueFireGroup) {
    blueFireGroup.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    if (blueFireGroup.parent) {
      blueFireGroup.parent.remove(blueFireGroup);
    }
    blueFireGroup = null;
    blueFireLight = null;
    blueFireHaloMesh = null;
    blueFireSparksMesh = null;
  }

  camera = null;
  clock = null;
  starsMesh = null;
  starMeshes.length = 0;
  billboardMeshes.length = 0;
  cameraDuration = 0;
}
