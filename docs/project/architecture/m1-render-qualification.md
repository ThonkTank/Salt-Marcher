# M1 rendering qualification procedure

This procedure is the evidence route for the Electron Go/No-Go gate. It does
not turn a passing local test into a claim about `RP-H` hardware.

## Fixture and budgets

- PixiJS loads 100,000 deterministic sparse cells. The fixture contains 8,192
  designated visible facts and exercises culling.
- Babylon.js creates 25 pickable chunk meshes with orbit camera, hover, and
  selection.
- Camera and hover p95 is at most 16 ms. Local preview p95 is at most 50 ms.
- For each warm population, perform five unrecorded warm-ups followed by 100
  recorded operations. Sort each population separately; p95 is rank 95.
- Do not pool different OSs, cold/warm runs, actions, display scales, or GPU
  states.

## Required test matrix

On each supported Linux, Windows, and macOS `RP-H` machine, record:

1. OS, architecture, Electron version, CPU calibration, storage measurement,
   power mode, free space, display scale, and GPU model/driver.
2. Camera orbit, hover/pick, and local-preview populations at 1366 x 768 and
   at 200% scale. Record all p95 values and timeout failures.
3. A WebGL context-loss/restoration event for both 2D and 3D views. The app
   must retain its accessible text alternative and announce recovery rather
   than terminate.
4. Keyboard operation of the 2D view and the text alternative with a screen
   reader. Record the reader and version used.

The CI evidence route is `pnpm check`, `pnpm package`, and on Linux
`xvfb-run -a pnpm test:e2e`. The E2E journey creates Campaign A, creates
Campaign B, returns to A, and runs axe-core against the rendered shell.

## Current evidence

The fixture volume, p95 ranking, and threshold evaluation are unit tested.
The renderer exposes keyboard navigation, a text alternative, and explicit
WebGL-context recovery announcements. RP-H measurements and the cross-platform
CI run remain required before M1 acceptance.
