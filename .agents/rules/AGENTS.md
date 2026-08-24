# AGENTS.md · Workspace Rules for DeusFlow

## 1. Core Visual Directives
- **Atmosphere**: All 3D experiences must maintain the "Night in the Hogwarts Library" aesthetic: dark oak (`#0d0a08`), warm amber (`#1c130c`), soft candlelight bokeh, and subtle window light beams.
- **Matter**: Real torn parchment paper scraps & ink shards using `THREE.InstancedMesh` (400–600 physical 3D polygons). Use cream parchment (`#e8dcc0`), archival blue-black ink (`#1a1f2e`), and gold edge-glow accents (`#fce2b8`).
- **Strict Prohibition**: `gl_PointSize` or `gl_PointCoord` in the main matter shader is an **AUTOMATIC FAIL**. Main matter MUST be physical 3D polygonal geometry with tumbling rotation and double-sided lighting.
- **The One-Effect Rule**: Only one primary narrative action may occur at a time. All moving elements must be causally and mechanically linked to that action (e.g. elevator & gears principle). Disconnected decorative spinning objects are strictly forbidden.

## 2. Technical Directives
- **Single Draw Call**: The entire living shard universe must live inside a single `THREE.InstancedMesh` with a custom GLSL `ShaderMaterial`.
- **Pre-Commit Verification**: Run headless browser tests, grep for prohibited tokens (`gl_PointSize`), and inspect screenshots before any `git commit` or `git push`.
- **Mobile First**: All typography and 3D bounding boxes must adapt gracefully to mobile viewports (`390x844`).

## 3. 3D Model, GLTF Shading & Scene Integrity Rules
- **No Destructive Material Rewriting**: Never blindly instantiate `new THREE.MeshStandardMaterial` or `new THREE.MeshBasicMaterial` over `child.material` in glTF models. GLTFLoader binds multi-channel textures (emissive, alpha PNG, baseColor) internally; replacing the instance breaks channel routing (e.g. green-channel `alphaMap` failure causing kaleidoscope crystal glitches). Mutate native properties in-place.
- **Particle & Cloud Alpha Softening**: When glTF models have `alphaMode: MASK` with aggressive thresholds (`alphaCutoff >= 0.4`), always override in-place: `child.material.alphaTest = 0.001`, `child.material.transparent = true`, and `child.material.depthWrite = false` on all soft particulate/cloud layers (`Cloud_1`, `Cloud_2`, `Cloud_3`).
- **Depth-Write Integrity on Double-Sided Planes**: Overlapping transparent double-sided quads with `depthWrite: true` cause z-buffer cutouts and sticking feather artifacts. All transparent cloud layers MUST have `depthWrite: false` and `renderOrder = 2`.
- **Zero Specular on Hand-Painted Assets**: Hand-painted unlit/emissive models must have `roughness = 1.0`, `metalness = 0.0`, and pure diffuse ambient lighting to prevent glossy plastic/ice sheen.
- **Natural Space Orientation**: Never flip models with `rotation.y = Math.PI` without measuring bounding boxes. Camera trajectories must start in open airspace in front of the model and glide smoothly along the authored airway.

