# AGENTS.md · Workspace Rules for DeusFlow

## 1. Core Visual Directives
- **Atmosphere**: All 3D experiences must maintain the "Night in the Hogwarts Library" aesthetic: dark oak (`#0d0a08`), warm amber (`#1c130c`), soft candlelight bokeh, and subtle window light beams.
- **Matter**: Use cream parchment (`#e8dcc0`), archival blue-black ink (`#1a1f2e`), and gold edge-glow accents (`#fce2b8`).
- **The One-Effect Rule**: Only one primary narrative action may occur at a time. All moving elements must be causally and mechanically linked to that action (e.g. elevator & gears principle). Disconnected decorative spinning objects are strictly forbidden.

## 2. Technical Directives
- **Single Draw Call**: The entire living particle / shard universe must live inside a single `THREE.Points` or `THREE.InstancedMesh` with a custom GLSL `ShaderMaterial`.
- **Pre-Commit Verification**: Run headless browser tests and inspect screenshots before any `git commit` or `git push`.
- **Mobile First**: All typography and 3D bounding boxes must adapt gracefully to mobile viewports (`390x844`).
