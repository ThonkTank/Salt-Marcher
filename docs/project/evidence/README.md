# Evidence artifacts

Store reproducible, versioned acceptance evidence here: procedure,
environment, raw measurements where applicable, and result. Live CI status
belongs to GitHub rather than this directory.

For the M1 rendering decision, copy
[`m1-render-qualification-template.json`](m1-render-qualification-template.json)
to a dated evidence file on the measured RP-H machine. Fill all hardware fields
and the five-warm-up/100-recorded-operation raw populations for normal display
and 200% display separately; do not pool them or replace missing measurements
with a derived p95. Then validate the completed artifact:

```
pnpm qualify:render:validate docs/project/evidence/<dated-file>.json
```

Before the render run, create the structured calibration record with:

```
pnpm qualify:rp-h --output .tmp/rp-h-calibration.json --power-mode <mode> --dedicated-gpu false --server-class-hardware false --filesystem <name> --storage-device <name> --cache-state <state>
```

The command records the specified CPU streams, the 64 MiB sequential and 4 KiB
storage populations, its implementation revision, and a calculated RP-H
verdict. Copy the complete record into `environment.calibration`; the two
hardware-class flags require operator confirmation because they cannot be
determined portably. A failed calibration is valid only in a `status: "fail"`
render evidence record.

M1 covers one RP-H reference machine at normal display and 200% scaling. The
M6 cross-platform accessibility matrix owns the broader OS, mixed-DPI, and
monitor-change coverage.
The final resource record requires 20 build/dispose cycles and 20 completed
loss/restore/next-interaction cycles for **each** renderer.
Record at least three settled Electron working-set samples before and after
the renderer-cycle exercise; the validator applies the 10% steady-state and
75%-of-RP-H-budget limits to the conservative extrema.
The checked-in template is intentionally incomplete and **must not** validate;
only a completed `pass` or `fail` artifact is admissible acceptance evidence.
The schema and worksheet are generated from the executable Zod contract; run
`pnpm qualify:render:artifacts` after changing it, and
`pnpm qualify:render:artifacts:check` verifies the checked-in copies.

## Runtime observations from the packaged app

The rendering-qualification screen exports a versioned
`m1-runtime-observation-v1` JSON file. It is the source for every non-manual
renderer observation in the final evidence record: the four raw timing
populations, display dimensions and DPR, both actual WebGL canvas versions and
unmasked renderers, Chromium GPU feature status and active driver devices,
software-rendering verdict, cumulative recovery milestones, and the complete
resource-cycle result including working-set samples.

For each configuration, start a **new app process** from the AppImage. Select
the matching configuration only after confirming the display setup, perform
five warm-ups and 100 recorded actions for each population, and download one
complete runtime observation. Do this once for `normal` and, after changing to
200% scaling and confirming the effective 1366 × 768 display, once for
`scale200Percent`; never combine their populations.

In the normal-display process also exercise each context-loss control 20 times,
perform its indicated follow-up interaction after every restoration, then run
the 20 renderer build/dispose cycles. Download the observation again after the
resource run: its `resources` record includes the three working-set samples on
each side and the concrete canvas, mesh, and listener counts before and after.
If the process is interrupted, the scaling is wrong, a resource result is not
settled, or a population is incomplete, discard that affected observation and
repeat it in a fresh process. The only fields not supplied by observations are
the keyboard journey, text-alternative journey, and screen-reader name,
version, and result.
