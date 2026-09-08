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
  flameHeight: 0.65,     // Физическая высота пламени в единицах Three.js
  flameWidth: 0.75,      // Ширина пламени у основания
  flamePower: 0.75,      // Сила вертикальной тяги и длина выброса (0.2 - тихий огонёк, 1.5 - мощный столб)
  flameIntensity: 0.45,  // Накал и свечение самого огня и ореола (0.2 - тусклый/мягкий, 8.8 - яркий накал, 15.0 - ослепительный)

  // 1b. Конусность и плотность основания:
  flameTaper: 2.7,       // Сужение к верху: чем выше (1.5 - 3.5), тем уже и острее верхушка
  bottomSpread: 0.55,    // Ширина чаши у основания (0.5 - тонкая ножка, 1.3 - широкое устойчивое основание)
  bottomDensity: 0.7,    // Плотность и густота низа (0.5 - полупрозрачный, 2.0 - плотный насыщенный низ)

  // 1c. Размер искр:
  sparkScale: 1.0,       // Множитель размера искр (базовая геометрия уменьшена на 75%)

  // 2. Общий масштаб и позиционирование:
  scale: [1.0, 1.8, 2.0], // Общий масштаб эффекта [X, Y, Z] или число (масштабирует пламя, искры, ореол и свет!)
  offset: [0, -0.10, 0],   // Смещение относительно пустышки fog2 [X, Y, Z]

  // 3. Динамический источник света на скалах каньона (PointLight):
  lightIntensity: 17.0,  // Яркость мерцающего света на стенах каньона
  lightDistance: 15.0,   // Радиус освещения стен каньона
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

/* ====================================================================
 * 4. ALTAR MIST & BILLOWING STEAM ("ПАР И ДЫМКА НАД АЛТАРЕМ") CONFIGURATION
 * НАСТРОЙКИ ПАРА И ДЫМКИ НАД ЧАШЕЙ И ПЛИТОЙ АЛТАРЯ:
 * Меняйте параметры прямо здесь в коде, либо в консоли браузера:
 * ALTAR_MIST_CONFIG.<параметр> = ...
 * ==================================================================== */
export const rawAltarMistConfig = {
  // 1. Плотность и динамика пара над чашей и алтарем:
  opacity: 0.45,          // Прозрачность пара (0.2 - тонкая дымка, 0.45 - оптимум, 0.7 - густой пар; поддерживает и 0..1, и 0..100)
  flowSpeed: 0.35,        // Скорость клубящегося подъема и закручивания струй пара
  yOffset: 0.05,          // Вертикальный подъем пара над кромкой чаши (в метрах)

  // 2. Геометрия струй пара:
  steamHeight: 0.95,      // Высота подъема клубящихся струй пара над чашей
  steamRadius: 0.65,      // Ширина клубов пара над чашей
  waftSpread: 0.85,       // Ширина горизонтальной подушки дымки по плите алтаря

  // 3. Светлая небесная палитра (без черноты, светящийся эфирный пар):
  color: new THREE.Color(0xc5daf0),       // Светлый серебристо-голубой шелковый пар
  coreColor: new THREE.Color(0x90d8f0),   // Нежный бирюзовый отблеск у основания от синего огня
  rimColor: new THREE.Color(0xf2f7fc),    // Перламутровые тающие гребни пара
  puffColor: new THREE.Color(0xc5daf0),   // Для обратной совместимости
  groundColor: new THREE.Color(0xc5daf0), // Для обратной совместимости

  // 4. Напольная плоскость FOG.004 перед алтарем:
  hideFOG004: false,      // Напольный FOG.004 (false = активен с мягким бесшовным шейдером)

  // 5. Пустышки сзади (выключены по умолчанию):
  enableEmptiesPuffs: false, // Выключены по умолчанию (false)
  puffRadius: 1.65,       // Ширина клубов облачков
  puffHeight: 0.85,       // Высота подъема клубов облачков
  cloudSpread: 1.35,      // Радиус разброса клубов вокруг алтаря
  groundRadius: 2.50,     // Для совместимости

  // 6. Позиционирование и масштабирование:
  scale: [1.0, 1.0, 1.0], // Общий масштаб эффекта [X, Y, Z] или число
  offsetFog1: [0, 0.05, 0],      // Смещение относительно пустышки fog1 [X, Y, Z]
  offsetFire001: [0, 0.05, 0]    // Смещение относительно пустышки fire.001 [X, Y, Z]
};

let onAltarMistConfigChangeCallback = null;

export function registerAltarMistConfigListener(fn) {
  onAltarMistConfigChangeCallback = fn;
}

export const ALTAR_MIST_CONFIG = new Proxy(rawAltarMistConfig, {
  set(target, prop, val) {
    target[prop] = val;
    if (onAltarMistConfigChangeCallback) {
      onAltarMistConfigChangeCallback(prop, val);
    }
    return true;
  }
});

export function setAltarMistConfig(newConfig = {}) {
  if (!newConfig || typeof newConfig !== 'object') return ALTAR_MIST_CONFIG;
  for (const [key, val] of Object.entries(newConfig)) {
    ALTAR_MIST_CONFIG[key] = val;
  }
  console.log('[StoryConfig] ALTAR_MIST_CONFIG updated live in browser:', ALTAR_MIST_CONFIG);
  return ALTAR_MIST_CONFIG;
}

if (typeof window !== 'undefined') {
  window.ALTAR_MIST_CONFIG = ALTAR_MIST_CONFIG;
  window.setAltarMistConfig = setAltarMistConfig;
  window.ALTAR_STEAM_CONFIG = ALTAR_MIST_CONFIG;
}

