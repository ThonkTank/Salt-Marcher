# M1 rendering qualification procedure

This procedure is the evidence route for the Electron Go/No-Go gate. It does
not turn a passing local test into a claim about `RP-H` hardware.

## Fixture and budgets

- PixiJS loads 100,000 deterministic sparse cells through a world-space bucket
  index. Its initial viewport contains all 8,192 designated facts; keyboard
  pan dynamically reculls only intersecting buckets and ends its measurement
  on the next presented Pixi frame.
- Babylon.js creates 25 pickable chunk meshes plus a representative
  32 × 32 × 16 voxel chunk. Camera, hover/pick, and local voxel-preview remesh
  are separate populations and each ends at Babylon's next rendered frame.
- Camera and hover **frame-work** p95 is at most 16 ms. Local preview
  **input-to-first-visible-frame** p95 is at most 50 ms. Input-to-visible is
  additionally retained as a diagnostic for the other populations and is not
  substituted for their frame-work budget.
- For each warm population, perform five unrecorded warm-ups followed by 100
  recorded operations. Sort each population separately; p95 is rank 95.
- Do not pool different OSs, cold/warm runs, actions, display scales, or GPU
  states.

## M1 reference-machine acceptance

M1 accepts one named `RP-H` reference machine in its intended deployment
configuration. Its record must state the OS and exact display scale actually
tested; a M1 pass does not generalize to another OS, GPU, or scaling mode.
The M6 cross-platform accessibility matrix owns the full Linux, Windows, and
macOS coverage.

On the M1 reference machine, record:

1. OS, architecture, Electron version, CPU calibration, storage measurement,
   power mode, free space, display scale, and GPU model/driver.
2. Pixi pan, camera orbit, hover/pick, and local-preview populations at
   1366 x 768 and the declared display scale. Record all p95 values and
   timeout failures.
3. Exercise the supplied WebGL context-loss/restoration control for both 2D
   and 3D views at least 20 times each. After every restoration, perform the
   indicated next pan, camera, hover/pick, or preview interaction; only the
   displayed completed-cycle count is evidence of a successful recovery. The
   app must retain its accessible text alternative and announce recovery rather
   than terminate.
4. Keyboard operation of the 2D view and the text alternative with a screen
   reader. Record the reader and version used.
5. Run **20 renderer build/dispose cycles**. Record the displayed cycle count,
   before/after aggregate Electron working set, and settled canvas, mesh, and
   listener counts. A non-settled result is a failed resource observation, not
   a value to normalize away.

The CI evidence route is `pnpm check`, `pnpm package`, and on Linux
`xvfb-run -a pnpm test:e2e`. The E2E journey creates Campaign A, creates
Campaign B, returns to A, then starts a second Electron process with the same
data directory to confirm A remains active before making another mutation.
The Electron journey runs axe-core after the campaign input is rendered and
requires zero violations. Local ChromeDriver session setup/teardown can still
block before that assertion completes.

## Current evidence

The fixture volume, spatial-index invariant, voxel remesh, p95 ranking, and
threshold evaluation are unit tested. The renderer exposes keyboard navigation,
a keyboard-operable text alternative, local-preview instrumentation, and
explicit WebGL-context recovery controls and announcements. Final evidence is
validated with `pnpm qualify:render:validate <file>`. The checked-in form is
not measurement evidence: reference-machine measurements, explicit context-loss
exercise, resource-cycle observations, and a screen-reader record remain
required before M1 acceptance.
