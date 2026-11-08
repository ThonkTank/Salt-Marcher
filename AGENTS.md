# Repository instructions

- This project has no production users or production data requiring preservation.
- Development data is disposable. Schema migrations and backward compatibility are not required; choose the simplest coherent implementation for the authorized work.
- Preserve unrelated working changes and files. Do not delete unrelated files, reset the working tree, or overwrite existing work.
- The active desktop editor is Atlas V7. Its architecture and the pure house-local interior solver are described in `docs/architecture.md`; observable behavior, persisted format and limits are defined once in `docs/product-contract.md`.
- Exactly four authoritative product/development documents are maintained: `README.md` (setup and commands), `docs/architecture.md` (ownership and implementation), `docs/product-contract.md` (behavior), and `docs/implementation/status.md` (latest checked state, decisions, open limits and next handoff). Read these for current work; generated evidence and plans are not runtime contracts.
- The user-requested durable Atlas rebuild assignment is `docs/implementation/atlas-rebuild-plan.md`. When asked to execute that plan (including a reference plus "erledige das"), carry out its full P0–P9 scope and completion criteria. It describes the intended future state, not implemented behavior. Keep this one execution plan versioned and linked; do not create parallel plans or reports. Unrelated tasks do not activate the rebuild.
- Replace the short current status when work changes the checked state. Record detailed check logs and temporary plans under ignored `src-tauri/target/cleanup/` or `src-tauri/target/diagnostics/<run>/`; do not add historical reports, screenshots, raw data, source copies or builds to `docs/`.
