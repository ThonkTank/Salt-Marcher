# Finaler Nacharbeitsbericht

Generated from the strict final-evidence contract and the closed delta ledger.

## 1. Ergebnis

- Gesamtstatus: `COMPLETE`
- Application-SHA: `025e6866dce78b028e4933b35466e5466ecb79e5`
- Evidence-Commit-SHA: repository HEAD after the single allowlisted evidence commit
- `origin/main`-SHA at promotion: `025e6866dce78b028e4933b35466e5466ecb79e5`
- App-Input-Fingerprint Application/Evidence: `064e57c74a92aed9a7e0954afef98ce9e7601f0dc38678cac7d1693d74c5bd6e` (the evidence gate requires equality)
- PRs und Promotionsfolge: candidate run 32247027225 → fresh handoff → fast-forward promotion → main run 32251211058 → evidence commit

## 2. Nutzerrelevantes Ergebnis

Campaign replacement and import now preserve the last valid copy through
failures and restarts. Session interactions have explicit owners and stale
async results cannot overwrite newer state. The installed local application is
the same qualified artifact, with backed-up campaign data and verified domain
readbacks.

## 3. Meilensteine

| Meilenstein | Status | PR/Commit(s) | Wichtigster Beweis |
|---|---|---|---|
| M0 Datensicherheit | complete | 922277cd1 | Campaign lifecycle check |
| M1 Delivery/Evidence | complete | 6b5e95037 | Delivery contract check |
| M2 Campaign Lifecycle/Import | complete | 5b2315ced–e044974a8 | Lifecycle/import checks |
| M3 Registries/Architekturgates | complete | 6ace58a–9a6ec346e | Runtime-contract check |
| M4 Persistenzmodule | complete | d6f6b8d–18dd3b9 | Persistence-module check |
| M5 Session UI/E2E | complete | 58b88e3df | Session-UI check |
| M6 CI-Effizienz | complete | 58b88e3df | Delivery and CI policy checks |
| M7 Abschluss | complete | Application-SHA | Final evidence contract |

## 4. Delta-Ledger

| Präfix | Gesamt | Verified | Not applicable | Open/In progress/Blocked |
|---|---:|---:|---:|---:|
| PRES | 6 | 6 | 0 | 0 |
| SAFE | 5 | 5 | 0 | 0 |
| STORE | 6 | 6 | 0 | 0 |
| IMPORT | 7 | 7 | 0 | 0 |
| REG/ARCH | 9 | 9 | 0 | 0 |
| PERSIST | 6 | 6 | 0 | 0 |
| UI/E2E | 10 | 10 | 0 | 0 |
| DEL | 10 | 10 | 0 | 0 |
| DOC/DISC | 5 | 5 | 0 | 0 |

Alle `not_applicable`- und `DISC-*`-Entscheidungen:
- None.

## 5. Datensicherheit und Campaign-Lifecycle

- The failure matrix covers stage validation, both renames, reopen, registry commit, readback, cleanup, and restart recovery.
- Connection and registry owners fail closed; a replacement is not accepted before SQLite and domain validation.
- Cleanup is restartable and never removes the last validated campaign copy together with its replacement.

## 6. Campaign Import

- The import saga records validate, diff, apply, readback, activate, and cleanup phases.
- Capability-owned section adapters replace the central mapping/deletion switch.
- Idempotent reimport preserves local additions while changed source facts receive deterministic deltas.
- Promotion requires the semantic readback and SQLite quick check recorded by the import receipt.

## 7. Architektur nach dem Schnitt

### Campaign-Lifecycle-Owner

- Registry: campaign registry owner with immutable records.
- Connection: campaign connection lifecycle owner.
- Directory Transition: restartable campaign directory transition.
- Schema Bootstrap: installation and campaign schema owners compose explicitly.

### Operations/Utility

- Capability-owned operation fragments form one validated registry.
- Preload exposure and utility handlers are checked against that registry.
- The utility application is a declarative composition root.

### Persistenzmodule

- Generated-run codecs, command repositories, and query repositories have separate owners.
- NPC command/query persistence is isolated from world composition.
- Historical generated runs remain readable through versioned codecs.

### Session UI/CSS

- Hooks own mutation, reference-follow, scene, group, dialog, and loot state transitions.
- Feature styles own their selectors; the workspace shell owns layout only.
- Deferred-race, keyboard, focus, localization, and visual-owner suites provide the UI evidence.

## 8. Verifikation

### Fokussierte Checks

| Befehl | Ergebnis | Dauer | Evidenz |
|---|---|---:|---|
| `check:campaign-lifecycle` | success | recorded in handoff check | focused manifest |
| `check:campaign-import` | success | recorded in handoff check | focused manifest |
| `check:runtime-contracts` | success | recorded in handoff check | focused manifest |
| `check:persistence-modules` | success | recorded in handoff check | focused manifest |
| `check:session-ui` | success | recorded in handoff check | focused manifest |
| `check:delivery` | success | recorded in handoff check | focused manifest |

### Candidate-CI

- Run/Attempt: [32247027225](https://github.com/ThonkTank/Salt-Marcher/actions/runs/32247027225) / 1
- Required-Job-Manifest-Version: 1
- Portable · static and app (portable-static-and-contracts): success
- Native · windows-2022 (windows-native-sqlite-runtime): success
- Native · macos-latest (macos-native-sqlite-runtime): success
- Linux build · reusable app (linux-app-build-authority): success
- Linux package · profile and AppImage (linux-package-runtime): success
- Linux qualification · packaged harness (linux-packaged-qualification-harness): success
- Linux E2E · campaign-workspaces (linux-e2e-campaign-workspaces): success
- Linux E2E · hex-npc-restart (linux-e2e-hex-npc-restart): success
- Linux E2E · dialogs-generation-loot (linux-e2e-dialogs-generation-loot): success
- Linux E2E · group-loot-travel (linux-e2e-group-loot-travel): success
- Linux Visual · goldens (linux-visual-goldens): success
- Linux E2E · passive window (linux-e2e-passive-window): success
- Common application output hash: `f737155f23c6c22ff6dee0fd120f0f1f779c4b5c3e881ea1ac1c244d7e0eb44b`
- Failed suites retain receipts, logs, screenshots, and diffs as workflow artifacts.

### Handoff/Installation

- Invocation: `af834177-5347-452b-a586-191d0bbebdd3`; exactly once: true
- check: 2155770 ms, output `75af79d540242b494763acdaba4f4ee6be4c4c09a753ba187bfced6f8e910058`
- package: 39927 ms, output `f737155f23c6c22ff6dee0fd120f0f1f779c4b5c3e881ea1ac1c244d7e0eb44b`
- packaged-smoke: 3371 ms, output `f737155f23c6c22ff6dee0fd120f0f1f779c4b5c3e881ea1ac1c244d7e0eb44b`
- backup-and-install: 1636 ms, output `f737155f23c6c22ff6dee0fd120f0f1f779c4b5c3e881ea1ac1c244d7e0eb44b`
- installed-runtime-verification: 3881 ms, output `f737155f23c6c22ff6dee0fd120f0f1f779c4b5c3e881ea1ac1c244d7e0eb44b`
- AppImage: `/home/aaron/salt-marcher-quality-reset-followup/release/local/SaltMarcher-Local-0.1.0.AppImage` / `4babd81d623219a014818bd113d55143c0f9c3aef54bc6daf2fd14bb0e4d2ced`
- Installed SHA-256: `4babd81d623219a014818bd113d55143c0f9c3aef54bc6daf2fd14bb0e4d2ced`
- Backup: `/home/aaron/.local/share/salt-marcher-local/backups/2026-08-19T12-08-57-657Z-5161780e3ff0-7b47517f` / manifest `37edf2d06d4f4b758bd77a6a7e873fae1e1fd35531edd70a256e05a0d71b2cb9`
- Utility ready, generation 1
- campaign: `campaigns/01a007a5-46b3-7000-84e8-58f3edd84e33/campaign.sqlite` — ok
- campaign: `campaigns/01a00a89-2ef5-7000-bafe-4d5f121e40aa/campaign.sqlite` — ok
- installation: `installation.sqlite` — ok
- installation.readyCampaignCount: expected `"at least 1"`, actual `2` — passed
- installation.activeCampaign: expected `"existing ready campaign"`, actual `"01a00a89-2ef5-7000-bafe-4d5f121e40aa"` — passed
- schema.campaign.campaigns/01a007a5-46b3-7000-84e8-58f3edd84e33/campaign.sqlite: expected `34`, actual `34` — passed
- schema.campaign.campaigns/01a00a89-2ef5-7000-bafe-4d5f121e40aa/campaign.sqlite: expected `34`, actual `34` — passed
- schema.installation.installation.sqlite: expected `35`, actual `35` — passed

### Main/Evidence

- Post-promotion run/attempt: [32251211058](https://github.com/ThonkTank/Salt-Marcher/actions/runs/32251211058) / 1
- Application-SHA on main: `025e6866dce78b028e4933b35466e5466ecb79e5`
- Evidence-Commit parent and allowlist are enforced by `delivery:verify-evidence`.
- The evidence gate proves identical Application/Evidence app-input fingerprints.

## 9. CI-Kosten vorher/nachher

| Metrik | Baseline | Final | Änderung |
|---|---:|---:|---:|
| Appbuilds pro Candidate/Promotion | 10 | 4 | -60% |
| Linux application builds | 7 | 1 | -86% |
| Candidate-Dauer | workflow run 32247027225 | same run, no duplicate local build | inspect linked run |
| Main-Post-Promotion-Dauer | full qualification | one attestation job | reduced |
| native Plattformjobs | Windows/macOS/Linux | Windows/macOS/Linux | no coverage loss |

No required platform, persistence, functional, visual, passive-window, package,
or qualification-harness coverage was removed.

## 10. Entfernte technische Schuld

Removed are raw campaign database locators, aggregate-wide schema ownership,
central operation and utility switches, duplicate workflow build paths, the
mega walking scenario, global feature-style compensation, and manually edited
live completion claims.

## 11. Bewusste Nichtziele und Grenzen

No product features, generic ORM/DI framework, Java compatibility layer, or
renderer filesystem access were introduced. Cross-platform local installation
remains outside the Linux AppImage handoff boundary.

## 12. Reproduktion

1. `git show --no-patch --format=%H HEAD^`
2. `corepack pnpm check:campaign-lifecycle`
3. `corepack pnpm check:campaign-import`
4. `corepack pnpm check:runtime-contracts`
5. `corepack pnpm check:persistence-modules`
6. `corepack pnpm check:session-ui`
7. `corepack pnpm check:delivery`
8. `gh run view 32247027225`
9. `corepack pnpm delivery:verify-evidence 025e6866dce78b028e4933b35466e5466ecb79e5`
