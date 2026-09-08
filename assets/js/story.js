/**
 * assets/js/story.js
 * 
 * DeusFlow 3D Cinematic Story Orchestrator.
 * Modular, production-ready ES6 entry point delegating to specialized engines:
 * - config.js: Central source of truth for lighting, dispersion, and blue fire.
 * - i18n.js: Multilingual dictionary (EN, UK, DA) and URL parameter sync.
 * - hud.js: DOM HUD, act stepper, progress indicator, loading overlay, finale card.
 * - vfx/blueFire.js: Procedural blue fire, radial volumetric halo, physical sparks, PointLight.
 * - vfx/stars.js: Volumetric 3D starfield dispersion & chromatic scintillation shader.
 * - vfx/clouds.js: Layered billboard clouds (airy mist vs dense cores) & horizontal ground fog.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Timer } from 'three/addons/misc/Timer.js';

// Re-export configs for external consumers & backwards compatibility
export {
  STORY_LIGHT_CONFIG,
  BLUE_FIRE_CONFIG,
  setBlueFireConfig,
  ALTAR_MIST_CONFIG,
  setAltarMistConfig
} from './story/storyConfig.js';
import { getLightConfigIntensity, BLUE_FIRE_CONFIG, ALTAR_MIST_CONFIG } from './story/storyConfig.js';
import { getStoryI18n } from './story/i18n.js';
import { createBlueFire, updateBlueFire, getBlueFireState, cleanupBlueFire } from './story/vfx/blueFire.js';
import { createAltarMist, updateAltarMist, getAltarMistState, cleanupAltarMist } from './story/vfx/altarMist.js';
import {
  processStarMesh,
  updateStars,
  getStarMeshes,
  getStarStats,
  getStarGeometryDetails,
  getStarQuadCenters,
  getQuadVertices,
  cleanupStars
} from './story/vfx/stars.js';
import {
  processBillboardCloud,
  processGroundFog,
  processUnlitMeshes,
  updateClouds,
  getBillboardMeshes,
  getMistCloudCount,
  getDenseCloudCount,
  cleanupClouds
} from './story/vfx/clouds.js';
import {
  applyInitialI18n,
  updateLoadingProgress,
  showLoadingError,
  hideLoadingOverlay,
  setupHudStepper,
  updateHud,
  triggerFinalRedirect,
  cleanupHud
} from './story/hud.js';

// --- Scene & Core Variables ---
let scene = null;
let camera = null;
let renderer = null;
const timer = new Timer();
let animationFrameId = null;

// --- Split Animation Mixers ---
let cameraMixer = null;
let portalMixer = null;
let cameraDuration = 0;
let cameraClipEntries = [];

// --- GSAP & Scroll State ---
let scrollTriggerInstance = null;
let resizeHandler = null;
let hasRedirected = false;
const FINAL_REDIRECT_URL = 'PLACEHOLDER_NEXT_PAGE_URL';

const gltfLights = new Map();
const i18nStrings = getStoryI18n();

/**
 * Scrubs camera animation clips safely based on normalized scroll progress [0, 1].
 */
export function setCameraScrollProgress(progress) {
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
  if (camera) {
    camera.updateMatrixWorld(true);
  }
}

/**
 * Sets up GSAP ScrollTrigger for inertial scrubbing.
 */
function setupScrollTrigger() {
  const scrollTriggerObj = window.ScrollTrigger || (typeof ScrollTrigger !== 'undefined' ? ScrollTrigger : null);
  if (!scrollTriggerObj) {
    console.warn('[StoryEngine] GSAP ScrollTrigger not loaded on window.');
    return;
  }

  const scrollWrapper = document.querySelector('.scroll-wrapper') || document.body;

  scrollTriggerInstance = scrollTriggerObj.create({
    trigger: scrollWrapper,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.2,
    onUpdate: (self) => {
      const progress = self.progress;

      setCameraScrollProgress(progress);
      updateHud(progress, i18nStrings);

      if (progress >= 0.999 && !hasRedirected) {
        hasRedirected = true;
        triggerFinalRedirect(FINAL_REDIRECT_URL);
      }
    }
  });

  setupHudStepper((targetP) => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({
      top: targetP * maxScroll,
      behavior: 'smooth'
    });
  }, i18nStrings.chapters);
}

/**
 * Responsive window resize handler.
 */
function onWindowResize() {
  if (!renderer) return;

  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  if (camera) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  if (typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.refresh();
  }
}

/**
 * Main 60/120 FPS animation loop.
 */
function animate() {
  animationFrameId = requestAnimationFrame(animate);

  timer.update();
  const delta = timer.getDelta();
  const elapsed = timer.getElapsed ? timer.getElapsed() : performance.now() * 0.001;

  // 1. Ambient Portal Animation
  if (portalMixer) {
    portalMixer.update(delta);
  }

  // 2. Billboard clouds facing camera & near-dissolve
  updateClouds(camera);

  // 3. Dynamic star scintillation & chromatic shimmer
  updateStars(elapsed);

  // 4. Procedural blue fire & rock wall illumination
  updateBlueFire(elapsed, camera);

  // 4b. Hybrid Altar creeping mist & volumetric smoke puffs (fog1 & fire.001)
  updateAltarMist(elapsed, delta, camera);

  // 5. Render active scene with extracted GLTF camera
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

/**
 * Initializes the Three.js Cinematic Scene and loads Story3.glb.
 */
export function initStoryEngine() {
  const canvas = document.getElementById('webgl-canvas');
  if (!canvas) {
    console.error('[StoryEngine] Could not find #webgl-canvas');
    return;
  }

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0d14, 0.015);

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const loader = new GLTFLoader();
  loader.load(
    '/assets/models/Story3.glb',
    (gltf) => {
      const root = gltf.scene;
      scene.add(root);

      // 1. Extract Camera
      if (gltf.cameras && gltf.cameras.length > 0) {
        camera = gltf.cameras.find((c) => c.name === 'Camera') || gltf.cameras[0];
      } else {
        root.traverse((child) => {
          if (!camera && child.isCamera) camera = child;
        });
      }

      if (!camera) {
        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 2, 10);
      }

      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      // 2. Split Animation Mixers
      const animations = gltf.animations || [];
      const scrollClips = [];
      const portalClips = [];

      const portalNode = root.getObjectByName('Sketchfab_model') || root.getObjectByName('portal');
      const portalNodeNames = new Set();
      if (portalNode) {
        portalNode.traverse((obj) => {
          if (obj.name) portalNodeNames.add(obj.name.toLowerCase());
        });
      }

      function isPortalAnimation(clip) {
        const nameLower = clip.name.toLowerCase();
        if (nameLower.includes('sketchfab') || nameLower.includes('portal')) return true;
        if (portalNodeNames.size > 0) {
          const targetsPortal = clip.tracks.some((track) => {
            const trackTargetName = track.name.split('.')[0].toLowerCase();
            return portalNodeNames.has(trackTargetName);
          });
          if (targetsPortal) return true;
        }
        return nameLower.includes('take 001');
      }

      animations.forEach((clip) => {
        if (isPortalAnimation(clip)) {
          portalClips.push(clip);
        } else {
          scrollClips.push(clip);
        }
      });

      cameraClipEntries = [];
      if (scrollClips.length > 0) {
        cameraDuration = scrollClips.reduce((max, clip) => Math.max(max, clip.duration), 0);

        scrollClips.forEach((clip) => {
          clip.duration = Math.max(clip.duration, cameraDuration);
          const mixer = new THREE.AnimationMixer(root);
          const action = mixer.clipAction(clip);
          action.clampWhenFinished = true;
          action.setLoop(THREE.LoopOnce);
          action.play();
          cameraClipEntries.push({ mixer, action, clip });
        });
        cameraMixer = cameraClipEntries[0]?.mixer || null;
      }

      if (portalClips.length > 0) {
        portalMixer = new THREE.AnimationMixer(portalNode || root);
        portalClips.forEach((clip) => {
          const action = portalMixer.clipAction(clip);
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.play();
        });
      }

      // 3. GLTF Scene Traversal
      gltfLights.clear();
      let fireTargetNode = null;
      let altarFog1Node = null;
      let altarFire001Node = null;
      let fog004MeshNode = null;

      root.traverse((child) => {
        // Punctual lights scaling
        if (child.isLight) {
          const configIntensity = getLightConfigIntensity(child.name) ?? (child.parent ? getLightConfigIntensity(child.parent.name) : null);
          const rawIntensity = child.intensity;
          if (configIntensity !== null) {
            child.intensity = configIntensity;
          } else if (child.intensity > 10) {
            child.intensity = THREE.MathUtils.clamp(child.intensity / 2500, 1.0, 5.0);
          }
          gltfLights.set(child.name, child);
          console.log(`[StoryEngine] Scaled punctual light "${child.name}" (${child.type}): raw ${rawIntensity.toFixed(1)} -> scaled ${child.intensity.toFixed(2)}`);
        }

        // Detect target empty node for Blue Fire (fog2 priority)
        if (child.name === 'fog2' || child.name.toLowerCase() === 'fog2') {
          fireTargetNode = child;
        }

        // Detect altar empty nodes for hybrid mist/smoke shroud (fog1 and fire.001)
        if (child.name === 'fog1' || child.name.toLowerCase() === 'fog1') {
          altarFog1Node = child;
        }
        if (child.name === 'fire001' || child.name === 'fire.001' || child.name.toLowerCase() === 'fire001' || child.name.toLowerCase() === 'fire.001') {
          altarFire001Node = child;
        }

        if (child.isMesh) {
          // Unlit conversion for Cloud_Poly and Sky
          processUnlitMeshes(child);

          const isBillboard = child.name.startsWith('Bilboard');
          const isGroundFog = child.name.startsWith('FOG') || child.name.toLowerCase().includes('fog');

          if (isBillboard) {
            processBillboardCloud(child);
          } else if (isGroundFog) {
            if (child.name === 'FOG004' || child.name === 'FOG.004') {
              fog004MeshNode = child;
            }
            processGroundFog(child);
          }

          // Stars de-gridding & scintillation shader
          if (child.name.toLowerCase() === 'stars' || child.name.toLowerCase().includes('star')) {
            processStarMesh(child);
          }
        }
      });

      // 4. Attach Blue Fire to target empty node (fog2)
      if (fireTargetNode) {
        createBlueFire(fireTargetNode);
      }

      // 4b. Attach Hybrid Altar Mist (Option 1 + Option 2) to altar empty nodes (fog1 & fire.001)
      if (altarFog1Node || altarFire001Node || fog004MeshNode) {
        createAltarMist(altarFog1Node, altarFire001Node, fog004MeshNode);
      }

      // 5. Setup Window Resize & ScrollTrigger
      resizeHandler = onWindowResize;
      window.addEventListener('resize', resizeHandler);
      setupScrollTrigger();

      // Initial track frame
      setCameraScrollProgress(0);

      // Expose debug state for verification testing & DevTools
      window.__STORY_STATE__ = {
        cameraLoaded: !!camera,
        cameraName: camera ? camera.name : null,
        cameraDuration,
        cameraClipsCount: scrollClips.length,
        ambientClipsCount: portalClips.length,
        scrollClipsCount: scrollClips.length,
        portalClipsCount: portalClips.length,
        billboardCount: getBillboardMeshes().length,
        mistCloudCount: getMistCloudCount(),
        denseCloudCount: getDenseCloudCount(),
        hasStars: getStarMeshes().length > 0,
        starsCount: getStarMeshes().length,
        get hasBlueFire() { return getBlueFireState().hasBlueFire; },
        get blueFireNodeName() { return getBlueFireState().nodeName; },
        get blueFirePos() { return getBlueFireState().pos; },
        get blueFireIntensity() { return getBlueFireState().intensity; },
        get blueFireConfig() { return BLUE_FIRE_CONFIG; },
        get hasAltarMist() { return getAltarMistState().hasAltarMist; },
        get altarMistState() { return getAltarMistState(); },
        get altarMistConfig() { return ALTAR_MIST_CONFIG; },
        setScrollProgress: (progress) => {
          setCameraScrollProgress(progress);
          updateHud(progress, i18nStrings);
        },
        getCameraPosition: () => {
          if (!camera) return { x: 0, y: 0, z: 0 };
          return { x: camera.position.x, y: camera.position.y, z: camera.position.z };
        },
        getAllObjects: (filterName) => {
          const res = [];
          scene?.traverse((c) => {
            if (!filterName || c.name.toLowerCase().includes(filterName.toLowerCase())) {
              res.push({
                name: c.name,
                type: c.type,
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
            if (c.name === name || c.name.toLowerCase() === name.toLowerCase()) {
              c.updateMatrixWorld(true);
              const posAttr = c.geometry?.attributes?.position;
              const verts = [];
              if (posAttr) {
                const v = new THREE.Vector3();
                for (let i = 0; i < posAttr.count; i++) {
                  v.fromBufferAttribute(posAttr, i);
                  v.applyMatrix4(c.matrixWorld);
                  verts.push([+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]);
                }
              }
              found = {
                name: c.name,
                materialType: c.material?.type,
                materialName: c.material?.name,
                isMeshBasicMaterial: c.material?.isMeshBasicMaterial === true,
                hasMap: !!c.material?.map,
                color: c.material?.color ? c.material.color.toArray() : null,
                opacity: c.material?.opacity,
                transparent: c.material?.transparent,
                depthWrite: c.material?.depthWrite,
                alphaTest: c.material?.alphaTest,
                blending: c.material?.blending,
                vertexCount: c.geometry?.attributes?.position?.count,
                geometryType: c.geometry?.type,
                position: [c.position.x, c.position.y, c.position.z],
                scale: [c.scale.x, c.scale.y, c.scale.z],
                worldVertices: verts
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
        },
        getStarDispersionStats: getStarStats,
        getStarGeometryDetails: getStarGeometryDetails,
        getStarQuadCenters: getStarQuadCenters,
        getQuadVertices: getQuadVertices
      };

      // Hide loading screen and start loop
      hideLoadingOverlay();
      animate();
    },
    (event) => {
      if (event.total > 0) {
        const progress = Math.round((event.loaded / event.total) * 100);
        updateLoadingProgress(progress, i18nStrings.loading);
      }
    },
    (err) => {
      console.error('[StoryEngine] Failed to load Story3.glb:', err);
      showLoadingError('Error loading 3D scene');
    }
  );
}

/**
 * Deep GPU Memory Cleanup & Scene Destruction.
 */
export function destroyStoryScene() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (scrollTriggerInstance) {
    scrollTriggerInstance.kill();
    scrollTriggerInstance = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  cleanupHud();
  cleanupClouds();
  cleanupStars();
  cleanupBlueFire();
  cleanupAltarMist();

  if (cameraMixer) {
    cameraMixer.stopAllAction();
    cameraMixer = null;
  }

  if (portalMixer) {
    portalMixer.stopAllAction();
    portalMixer = null;
  }

  if (scene) {
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    scene.clear();
    scene = null;
  }

  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
}

// Auto-boot on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyInitialI18n(i18nStrings);
      initStoryEngine();
    });
  } else {
    applyInitialI18n(i18nStrings);
    initStoryEngine();
  }
}
