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
