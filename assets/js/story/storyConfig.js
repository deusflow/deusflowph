/**
 * assets/js/story/storyConfig.js
 * 
 * Central Configuration for DeusFlow 3D Cinematic Story Engine.
 * Single source of truth for lights, starfield dispersion, and procedural blue fire.
 */
import * as THREE from 'three';

/* ====================================================================
 * 1. GLTF PUNCTUAL LIGHTS CONFIGURATION (KHR_lights_punctual)
 * Clamps massive Blender lumen exports (10,000 - 200,000) to sane WebGL intensities.
 * ==================================================================== */
export const STORY_LIGHT_CONFIG = {
  'base light to portal': 3.5,
  'contlight2': 200,
  'front light to portal': 3.0,
  'Point': 100,
  'portal l centr': 50
};

export function getLightConfigIntensity(name) {
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

/* ====================================================================
 * 2. STAR GEOMETRY DISPERSION & DE-GRIDDING CONFIGURATION
 * Converts rigid 2D planar star sheets from Blender into organic 3D starfields.
 * ==================================================================== */
export const STAR_DISPERSION_CONFIG = {
  borderCullRate: 0.65,    // Dissolve 65% of stars along Blender's rigid bounding perimeter lines
  interiorDupeRate: 0.45,  // Keep 45% of interior duplicate quads to enrich 3D volume softly
  jitterBorder: 0.65,      // Spatial displacement for perimeter stars
  jitterInterior: 0.32,    // Spatial displacement for interior stars
  depthSpreadZ: 2.2,       // Volumetric 3D canyon depth spread (converts 2D sheet into 3D airspace)
  minScale: 0.50,          // Minimum quad scale (distant pinprick)
  maxScale: 1.35           // Maximum quad scale (radiant jewel)
};

/* ====================================================================
 * 3. PROCEDURAL BLUE FIRE (GOBLET OF FIRE AT FOG2) CONFIGURATION
 * НАСТРОЙКИ СИНЕГО ПЛАМЕНИ:
 * Меняйте параметры прямо здесь в коде, либо в консоли браузера:
 * BLUE_FIRE_CONFIG.<параметр> = ...
 * ==================================================================== */
export const rawBlueFireConfig = {
  // 1. Высота и мощность пламени:
  flameHeight: 1.35,     // Физическая высота пламени в единицах Three.js
  flameWidth: 0.68,      // Ширина пламени у основания
  flamePower: 0.85,      // Сила вертикальной тяги и длина выброса (0.2 - тихий огонёк, 1.5 - мощный столб)
  flameIntensity: 8.8,   // Накал и свечение шейдера самого огня

  // 2. Общий масштаб и позиционирование:
  scale: [1.0, 1.0, 1.0], // Общий масштаб эффекта [X, Y, Z] или число (масштабирует пламя, искры, ореол и свет!)
  offset: [0, 0, 0],      // Смещение относительно пустышки fog2 [X, Y, Z]

  // 3. Динамический источник света на скалах каньона (PointLight):
  lightIntensity: 5.4,   // Яркость мерцающего света на стенах каньона
  lightDistance: 10.5,   // Радиус освещения стен каньона
  lightDecay: 1.8,       // Скорость затухания света
  lightColor: 0x00c8ff,  // Бирюзово-голубой цвет света

  // 4. Цвета пламени:
  baseColor: new THREE.Color(0x011470), // Глубокий сапфировый низ
  midColor: new THREE.Color(0x00d4ff),  // Бирюзовое тело
  coreColor: new THREE.Color(0xf0fbff)  // Белое ядро накала
};

// Global callback for live VFX updates across files
let onConfigChangeCallback = null;

export function registerBlueFireConfigListener(fn) {
  onConfigChangeCallback = fn;
}

export const BLUE_FIRE_CONFIG = new Proxy(rawBlueFireConfig, {
  set(target, prop, val) {
    target[prop] = val;
    if (onConfigChangeCallback) {
      onConfigChangeCallback(prop, val);
    }
    return true;
  }
});

export function setBlueFireConfig(newConfig = {}) {
  if (!newConfig || typeof newConfig !== 'object') return BLUE_FIRE_CONFIG;
  for (const [key, val] of Object.entries(newConfig)) {
    BLUE_FIRE_CONFIG[key] = val;
  }
  console.log('[StoryConfig] BLUE_FIRE_CONFIG updated live in browser:', BLUE_FIRE_CONFIG);
  return BLUE_FIRE_CONFIG;
}

// Expose directly to window for live editing in DevTools console
if (typeof window !== 'undefined') {
  window.BLUE_FIRE_CONFIG = BLUE_FIRE_CONFIG;
  window.setBlueFireConfig = setBlueFireConfig;
}
