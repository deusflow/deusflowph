---
name: verification-checklist
description: Mandatory pre-commit verification protocol: headless screenshot capture of load state, in-flight curl vortex, assembled forms, and mobile viewports, plus automated grep checks before any git commit or push.
---

# Mandatory Verification Protocol

Before executing ANY `git commit` or `git push origin main`, the agent MUST run:

---

## 1. Automated Grep Architectural Assertions
- Run `grep 'gl_PointSize' assets/js/story.js` and `grep 'gl_PointCoord' assets/js/story.js`.
- **Criterion**: The main matter shader MUST NOT contain `gl_PointSize` or `gl_PointCoord`. Any presence in the shard matter shader is an **AUTOMATIC FAIL**.
- Main matter must be a single `THREE.InstancedMesh` with 400–600 physical 3D polygonal torn parchment scrap instances.

---

## 2. Required Screenshot States
1. **State 0: Ambient Load State (`p = 0.00`)**:
   - Verify warm library gradient (`#0d0a08` $\rightarrow$ `#1c130c`), window light beam, and physical torn paper scraps hovering.
   - Verify NO pure black `#000000` void and NO rogue spinning objects.
2. **State 1: Form Crystallization (`p = 0.14`)**:
   - Verify crisp, legible Cyrillic text formed from real polygonal parchment/ink scraps with gold foil edges.
3. **State 2: Transition & Photomatrix Assembly (`p = 0.42`)**:
   - Verify shards tumbling in 3D and reforming the archival photograph with rich pixel colors.
4. **State 3: 3D Model & Dual Composition (`p = 0.92`)**:
   - Verify 3D camera on tripod on left and Crimea photo on right with zero viewport clipping.
5. **Mobile Viewport Check (390x844)**:
   - Verify responsive layout, no horizontal scroll, and clear legibility on mobile screens.

---

## 3. Zero-Console-Error Policy
- The test harness must assert `consoleLogs.length === 0` and `errors.length === 0`.
- Verify WebGL shader compilation passes with 0 warnings.
