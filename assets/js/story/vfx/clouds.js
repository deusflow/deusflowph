/**
 * assets/js/story/vfx/clouds.js
 * 
 * Billboard Atmospheric Clouds, Ground Fog & Unlit Mesh Processor for DeusFlow Story.
 * Fully compliant with AGENTS.md:
 * - Depth-write integrity on double-sided planes: depthWrite = false, renderOrder = 2 or 3
 * - Particle & Cloud alpha softening: alphaTest = 0.001 on mist, 0.01 on cloud cores
 * - Zero specular on hand-painted assets (Cloud_Poly & Sky unlit conversion)
 * - Bilboard planes dynamically lookAt camera with smooth distance near-fade
 */
import * as THREE from 'three';

const billboardMeshes = [];
const cameraWorldPos = new THREE.Vector3();
const meshWorldPos = new THREE.Vector3();

/**
 * Handles Billboard meshes: distinguishes airy misty halos from dense cloud cores.
 */
export function processBillboardCloud(child) {
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
  return child;
}

/**
 * Handles horizontal Ground Fog (e.g. M_BottomFog, FOG planes).
 * Crucial: static horizontal plane, must NOT rotate towards camera.
 */
export function processGroundFog(child) {
  const materials = Array.isArray(child.material) ? child.material : [child.material];
  materials.forEach((mat) => {
    mat.transparent = true;
    mat.depthWrite = false;
    mat.alphaTest = 0.01;
    mat.side = THREE.DoubleSide;
    mat.needsUpdate = true;
  });

  child.renderOrder = 2;
  return child;
}

/**
 * Converts hand-painted Cloud_Poly and Sky meshes to MeshBasicMaterial
 * to prevent emissive [1,1,1] blowout under scene lights.
 */
export function processUnlitMeshes(child) {
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
  return child;
}

/**
 * Orients billboards towards camera and applies camera distance near-fade.
 */
export function updateClouds(camera) {
  if (!camera || billboardMeshes.length === 0) return;

  camera.getWorldPosition(cameraWorldPos);
  for (let i = 0; i < billboardMeshes.length; i++) {
    const mesh = billboardMeshes[i];
    mesh.lookAt(cameraWorldPos);

    // Camera distance near-fade: dissolves billboards gently when camera flies in close
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

/**
 * Returns billboard mesh array.
 */
export function getBillboardMeshes() {
  return billboardMeshes;
}

export function getMistCloudCount() {
  return billboardMeshes.filter((m) => m.userData.isMist).length;
}

export function getDenseCloudCount() {
  return billboardMeshes.filter((m) => !m.userData.isMist).length;
}

/**
 * Cleans up billboard arrays on scene destroy.
 */
export function cleanupClouds() {
  billboardMeshes.length = 0;
}
