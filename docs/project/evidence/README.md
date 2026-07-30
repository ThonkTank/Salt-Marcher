# Evidence artifacts

Store reproducible, versioned acceptance evidence here: procedure,
environment, raw measurements where applicable, and result. Live CI status
belongs to GitHub rather than this directory.

For the M1 rendering decision, copy
[`m1-render-qualification-template.json`](m1-render-qualification-template.json)
to a dated evidence file on the measured RP-H machine. Fill all hardware fields
and the five-warm-up/100-recorded-operation raw populations; do not replace
missing measurements with a derived p95. The adjacent JSON schema keeps the
recorded artifact machine-readable. The checked-in template is deliberately
`pending-rp-h-measurement`, not acceptance evidence.
