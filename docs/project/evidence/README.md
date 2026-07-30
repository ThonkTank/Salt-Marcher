# Evidence artifacts

Store reproducible, versioned acceptance evidence here: procedure,
environment, raw measurements where applicable, and result. Live CI status
belongs to GitHub rather than this directory.

For the M1 rendering decision, copy
[`m1-render-qualification-template.json`](m1-render-qualification-template.json)
to a dated evidence file on the measured RP-H machine. Fill all hardware fields
and the five-warm-up/100-recorded-operation raw populations; do not replace
missing measurements with a derived p95. Then validate the completed artifact:

```
pnpm qualify:render:validate docs/project/evidence/<dated-file>.json
```

M1 covers one declared RP-H reference machine/configuration. The M6
cross-platform accessibility matrix owns the broader OS and scale coverage.
The checked-in template is intentionally incomplete and **must not** validate;
only a completed `pass` or `fail` artifact is admissible acceptance evidence.
