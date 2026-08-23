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
