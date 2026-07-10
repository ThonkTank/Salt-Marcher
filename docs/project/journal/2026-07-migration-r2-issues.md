Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: R2 issues discovered during the architecture migration and
left unchanged for normal product bug handling.

# July 2026 Architecture Migration R2 Issues

## 2026-07-09 m1.5-travel-render-pixel-diagnostic

Problem: the M1.5 render image parity harness found that the current
old-structure Dungeon Travel projection route can update the render model to
`z=1` while the captured canvas pixels remain unchanged from the prior `z=0`
image, even with offset multi-level geometry.

Evidence: `./gradlew dungeonMapRenderParityHarness --console=plain` passed
with `DT-IMG-001` same-frame `changedPixels=0` and diagnostic `z0-vs-z1
changedPixels=0`; the same harness proved the image diff oracle is not blind
through editor projection and wall-preview control diffs.

Disposition: preserve the old behavior during architecture migration. M1.5
keeps the Travel image comparison as same-frame parity and diagnostic control
evidence; any visible Travel projection rendering repair belongs to a separate
normal R2 bug path.
