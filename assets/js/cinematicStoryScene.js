/**
 * ============================================================================
 * CINEMATIC STORY SCENE ENGINE (Vanilla Three.js ES Module)
 * ============================================================================
 * Standalone embeddable cinematic runner powered by DeusFlow modular VFX:
 * - config.js: Central lighting, dispersion, and blue fire configurations
 * - vfx/blueFire.js: Procedural blue fire & rock wall illumination
 * - vfx/stars.js: Volumetric 3D star dispersion & scintillation shader
 * - vfx/clouds.js: Layered billboard clouds & ground fog separation
 * ============================================================================
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Timer } from 'three/addons/misc/Timer.js';

export { STORY_LIGHT_CONFIG, BLUE_FIRE_CONFIG, setBlueFireConfig } from './story/storyConfig.js';
import { getLightConfigIntensity } from './story/storyConfig.js';
import { createBlueFire, updateBlueFire, cleanupBlueFire } from './story/vfx/blueFire.js';
import { processStarMesh, updateStars, cleanupStars } from './story/vfx/stars.js';
import {
  processBillboardCloud,
  processGroundFog,
  processUnlitMeshes,
  updateClouds,
  cleanupClouds
} from './story/vfx/clouds.js';

// Scene & Module-level state
let scene = null;
let camera = null;
let renderer = null;
let timer = null;
let animationFrameId = null;

// Animation Mixers (Split Architecture)
let cameraMixer = null;
let portalMixer = null;
let cameraDuration = 0;
let cameraClipEntries = [];

const gltfLights = new Map();

// GSAP & Resize state
let scrollTriggerInstance = null;
let resizeHandler = null;

/**
 * Scrubs camera animation clips based on scroll progress [0, 1].
 */
function setCameraScrollProgress(progress) {
  if (cameraClipEntries.length === 0 || cameraDuration === 0) return;

  const clampedProgress = Math.max(0, Math.min(0.9999, progress));
  const targetTime = clampedProgress * cameraDuration;

  cameraClipEntries.forEach(({ clip, action, mixer }) => {
    const clipTime = Math.min(targetTime, Math.max(0, clip.duration - 0.0001));
    action.time = clipTime;
    mixer.setTime(targetTime);
  });

  if (camera) {
    camera.updateMatrixWorld(true);
  }
}

/**
 * Configures GSAP ScrollTrigger to scrub the camera path.
 */
function setupCameraScrollTrigger(scrollContainer) {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    console.warn('[CinematicScene] GSAP or ScrollTrigger not loaded on window.');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  scrollTriggerInstance = ScrollTrigger.create({
    trigger: scrollContainer || document.body,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.2,
    onUpdate: (self) => {
      setCameraScrollProgress(self.progress);
    }
  });

  setCameraScrollProgress(0);
}

/**
 * Main 60/120 FPS animation loop.
 */
function animate() {
  animationFrameId = requestAnimationFrame(animate);

  if (timer) {
    timer.update();
  }

  const delta = timer ? timer.getDelta() : 0.016;
  const elapsedSec = (timer && timer.getElapsed)
    ? timer.getElapsed()
    : performance.now() * 0.001;

  // 1. Ambient Portal Animation
  if (portalMixer) {
    portalMixer.update(delta);
  }

  // 2. Billboard clouds facing camera & near-dissolve
  updateClouds(camera);

  // 3. Dynamic celestial stars scintillation
  updateStars(elapsedSec);

  // 4. Procedural blue fire & dynamic canyon light
  updateBlueFire(elapsedSec, camera);

  // 5. Render Scene with GLTF Camera
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

/**
 * Window resize handler.
 */
function onWindowResize() {
  if (!camera || !renderer) return;

  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  if (typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.refresh();
  }
}

/**
 * Initializes the cinematic story scene inside an arbitrary canvas.
 */
export async function initCinematicScene({
  canvas,
  scrollContainer = document.body,
  glbUrl = '/assets/models/Story3.glb',
  onProgress = null,
  onLoaded = null
}) {
  if (!canvas) {
    throw new Error('[CinematicScene] Canvas element is required for initialization.');
  }

  cleanup();

  scene = new THREE.Scene();
  timer = new Timer();

  const fogColor = new THREE.Color(0x0d0a08);
  scene.background = fogColor;
  scene.fog = new THREE.Fog(fogColor, 15, 200);

  const ambientLight = new THREE.AmbientLight(0xffedd8, 1.2);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffe8cf, 1.5);
  keyLight.position.set(-15, 35, 20);
  scene.add(keyLight);

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const loader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      glbUrl,
      (gltf) => {
        const root = gltf.scene;
        scene.add(root);

        // 1. Camera extraction
        let extractedCamera = gltf.cameras.find((c) => c.name === 'Camera');
        if (!extractedCamera) {
          root.traverse((node) => {
            if (node.isCamera && (node.name === 'Camera' || !extractedCamera)) {
              extractedCamera = node;
            }
          });
        }

        if (!extractedCamera) {
          console.error('[CinematicScene] Camera named "Camera" not found in GLTF!');
          extractedCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
          scene.add(extractedCamera);
        }

        camera = extractedCamera;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        // 2. Animation split
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

        gltf.animations.forEach((clip) => {
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
          setupCameraScrollTrigger(scrollContainer);
        }

        if (portalClips.length > 0) {
          portalMixer = new THREE.AnimationMixer(portalNode || root);
          portalClips.forEach((clip) => {
            const action = portalMixer.clipAction(clip);
            action.setLoop(THREE.LoopRepeat);
            action.play();
          });
        }

        // 3. GLTF Traversal
        gltfLights.clear();
        let fireTargetNode = null;

        root.traverse((child) => {
          if (child.isLight) {
            const configIntensity = getLightConfigIntensity(child.name) ?? (child.parent ? getLightConfigIntensity(child.parent.name) : null);
            const rawIntensity = child.intensity;
            if (configIntensity !== null) {
              child.intensity = configIntensity;
            } else if (child.intensity > 10) {
              child.intensity = THREE.MathUtils.clamp(child.intensity / 2500, 1.0, 5.0);
            }
            gltfLights.set(child.name, child);
            console.log(`[CinematicScene] Scaled punctual light "${child.name}": raw ${rawIntensity.toFixed(1)} -> scaled ${child.intensity.toFixed(2)}`);
          }

          if (child.name === 'fog2' || child.name.toLowerCase() === 'fog2') {
            fireTargetNode = child;
          } else if (!fireTargetNode && (child.name === 'fire001' || child.name === 'fire.001')) {
            fireTargetNode = child;
          }

          if (child.isMesh) {
            processUnlitMeshes(child);

            const isBillboard = child.name.startsWith('Bilboard');
            const isGroundFog = child.name.startsWith('FOG') || child.name.toLowerCase().includes('fog');

            if (isBillboard) {
              processBillboardCloud(child);
            } else if (isGroundFog) {
              processGroundFog(child);
            }

            if (child.name.toLowerCase() === 'stars' || child.name.toLowerCase().includes('star')) {
              processStarMesh(child);
            }
          }
        });

        if (fireTargetNode) {
          createBlueFire(fireTargetNode);
        }

        resizeHandler = onWindowResize;
        window.addEventListener('resize', resizeHandler);

        animate();

        if (typeof onLoaded === 'function') onLoaded();
        resolve({ scene, camera, renderer, cleanup });
      },
      (progressEvent) => {
        if (progressEvent.lengthComputable && typeof onProgress === 'function') {
          const pct = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          onProgress(pct);
        }
      },
      (error) => {
        console.error('[CinematicScene] GLTF Load Error:', error);
        cleanup();
        reject(error);
      }
    );
  });
}

/**
 * Deep GPU Resource Disposal & Cleanup.
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

  cleanupClouds();
  cleanupStars();
  cleanupBlueFire();

  if (cameraMixer) {
    cameraMixer.stopAllAction();
    cameraMixer = null;
  }
  if (portalMixer) {
    portalMixer.stopAllAction();
    portalMixer = null;
  }
  cameraClipEntries = [];

  if (scene) {
    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        mats.forEach((m) => {
          for (const key of Object.keys(m)) {
            const val = m[key];
            if (val && typeof val === 'object' && typeof val.dispose === 'function') {
              val.dispose();
            }
          }
          m.dispose();
        });
      }
    });
    scene.clear();
    scene = null;
  }

  if (renderer) {
    renderer.dispose();
    renderer = null;
  }

  camera = null;
  timer = null;
  cameraDuration = 0;
}
