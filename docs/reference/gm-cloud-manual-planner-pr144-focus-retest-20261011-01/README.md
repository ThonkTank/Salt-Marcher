# GM-UX-PLANNER-FOCUS-PR144-RETEST-20261011-01

Status: **completed — bounded visible-browser PASS**. Dated focus comparison for #69 and PR144.

## Source and build

- Candidate: PR [#144](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/144), exact head `9d50a8f138c3bc0ac53abefb45e5625435cf110d`; PR base/shared at candidate publication: `632c580377366af66ab05efcefa3910564f8af48`.
- PR144 was open when checked. The tested files were built from its exact head, not from a later Shared checkout. Current Shared observed separately: `88a14b59bff3175e413895e97931b1e63693612f`.
- Product inputs in the candidate diff: `styles.css` and `tools/manual-planner-preview/index.html`; `tools/manual-planner-preview/build.mjs` and the package lock were unchanged from the base.
- Build: `node tools/manual-planner-preview/build.mjs` — PASS on Node `v24.19.0`; dependencies installed by `npm ci --ignore-scripts --no-audit --no-fund` in a temporary isolated checkout. Generated output SHA-256: `index.html` `ffe6b0e88f4a16575949d55436d724f8aefa931fafa036e7bf01fa0212b5b97b`; `preview.js` `91d73b51b23ec8319377acb1e3fd9ba8fd31ff272c861ac8c20cbf9b4fbe6781`.

## Isolated host and visible result

The preview ran in this managed cloud workspace, served only at `http://127.0.0.1:8779`, using Chromium `151.0.7922.173`, headless visual mode, viewport `1440×1000` CSS px, DPR 1. This was the preview’s documented memory-only session, not an Obsidian host or vault.

Starting from the visible blank “Manuelle Sessionplanung” page, I clicked **Szene hinzufügen**, filled the visible **Szenentitel** and **Notizen** fields, clicked the note field, then used Tab twice to reach **Entwurf übernehmen**. The pre-activation image shows its focus outline. I pressed Enter; the new scene title appeared and the focused **Entwurf übernehmen** control immediately retained a visible blue focus outline. I pressed Tab once; the visible outline moved to **Entwurf verwerfen**. This confirms the narrow Apply → immediate visible focus → Tab sequence on the candidate.

Screenshots (raw browser captures):

- [Before Apply](evidence/01-before-apply.png) — SHA-256 `3c463cdd08d47740bbe05e1cdc77ee5434e96f24214cf0e9eb6d1702509d41ca`.
- [Immediately after Apply](evidence/02-after-apply-focus.png) — SHA-256 `5acea6cadb9cbfba59fb49b73d65aa5c266ba6ac3347d5f57d1cdd76502903ef`.
- [After one Tab](evidence/03-after-tab.png) — SHA-256 `6517a39a5ff5852f3fdb927db3fec19038169295d0ea03eea16997437933822c`.

## Limits

This result covers only visible focus indication and next-Tab movement for the Apply action. It does not establish persistent save, reload/reopen, recovery, physical input, 200% zoom, native Obsidian behavior, general planner usability, or a full keyboard/accessibility pass. The preview explicitly warns that closing or reloading discards its in-memory plans. No product files were changed by this retest. No product latency was measured; browser automation/transport time is excluded.
