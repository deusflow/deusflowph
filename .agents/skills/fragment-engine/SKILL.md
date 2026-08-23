---
name: fragment-engine
description: Architecture for 3D living parchment & ink shard systems, multi-target buffer sampling (text, photo, GLTF surfaces), Simplex 3D curl turbulence, and velocity-driven resolution.
---

# Fragment Engine: Living 3D Shard Metamorphosis

## 1. Unified Prime Matter Principle
- **Never swap DOM cards with static PNGs**: All visual artifacts (words, archival photos, cameras) are formed by the **same 30,000 living shards** in WebGL.
- Single draw call on GPU via `THREE.Points` or `THREE.InstancedMesh`.

---

## 2. Multi-Target Sampling Pipeline
1. **Cyrillic Typography**:
   - Sample glyph contours from offscreen high-res Canvas (`ctx.font = 'bold 160px "Playfair Display"'`).
   - Store exact $(x, y, z)$ coordinates with subtle depth jitter ($\pm 0.04$).
2. **Archival Photographs**:
   - Raster scan texture pixels onto 3D grid.
   - Extract RGB colors (`aColorPhoto1`) to drive fragment shading.
3. **Complex 3D Objects (GLTF Models)**:
   - Traverse all child meshes with `child.updateWorldMatrix(true, false)`.
   - Build `MeshSurfaceSampler` per mesh and distribute points across the entire compound model.

---

## 3. GLSL Multi-Stage Morphing & Curl Noise
- **Progress Partitioning**:
  - Rest Plateaus: Morph factor reaches $1.0$, `morphArc = 0.0`, forms lock into place with zero turbulence.
  - Transition Arcs: $\sin(t \cdot \pi)$ injects Simplex 3D Curl Noise to disperse shards into an organic spiral wave.
- **Scroll Velocity Modulation**:
  - High scroll velocity: Shards disperse into a dynamic vortex.
  - Stopping: Shards magnetically crystallize into razor-sharp forms.
