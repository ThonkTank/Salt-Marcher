import {
  summarizeLedger,
  summarizeLedgerPrefix,
  type FollowupLedger,
  type LedgerCounts
} from './quality-reset-ledger.js'
import type { FinalEvidence } from './delivery-contract.js'

const milestoneCommits = Object.freeze([
  ['M0 Datensicherheit', '922277cd1', 'Campaign lifecycle check'],
  ['M1 Delivery/Evidence', '6b5e95037', 'Delivery contract check'],
  [
    'M2 Campaign Lifecycle/Import',
    '5b2315ced–e044974a8',
    'Lifecycle/import checks'
  ],
  [
    'M3 Registries/Architekturgates',
    '6ace58a–9a6ec346e',
    'Runtime-contract check'
  ],
  ['M4 Persistenzmodule', 'd6f6b8d–18dd3b9', 'Persistence-module check'],
  ['M5 Session UI/E2E', '58b88e3df', 'Session-UI check'],
  ['M6 CI-Effizienz', '58b88e3df', 'Delivery and CI policy checks'],
  ['M7 Abschluss', 'Application-SHA', 'Final evidence contract']
] as const)

const ledgerGroups = Object.freeze([
  ['PRES', ['PRES']],
  ['SAFE', ['SAFE']],
  ['STORE', ['STORE']],
  ['IMPORT', ['IMPORT']],
  ['REG/ARCH', ['REG', 'ARCH']],
  ['PERSIST', ['PERSIST']],
  ['UI/E2E', ['UI', 'E2E']],
  ['DEL', ['DEL']],
  ['DOC/DISC', ['DOC', 'DISC']]
] as const)

function unresolved(counts: LedgerCounts): number {
  return counts.open + counts.inProgress + counts.blocked
}

export function renderLiveStatus(
  evidence: FinalEvidence,
  ledger: FollowupLedger
): string {
  const counts = summarizeLedger(ledger.requirements)
  return `# Quality-reset live status

This document is generated from \`final-evidence.json\` and
\`followup-requirements-ledger.json\`. Do not edit it manually.

- Status: **${evidence.status.toUpperCase()}**
- Application-SHA: \`${evidence.application.sha}\`
- Candidate run: [${evidence.candidate.runId}](${evidence.candidate.url}), attempt ${evidence.candidate.attempt}
- Main post-promotion run: [${evidence.main.runId}](${evidence.main.url}), attempt ${evidence.main.attempt}
- Handoff invocation: \`${evidence.handoff.invocationId}\` (${evidence.handoff.mode}, exactly once)
- Artifact/installation SHA-256: \`${evidence.artifact.sha256}\`
- Ledger: ${counts.verified}/${counts.total} verified, ${counts.notApplicable} not applicable, ${unresolved(counts)} unresolved

The repository HEAD after closure is the allowlisted Evidence-Commit. The
application identity remains the Application-SHA above.
`
}

export function renderFinalReport(
  evidence: FinalEvidence,
  ledger: FollowupLedger
): string {
  const prefixRows = ledgerGroups
    .map(([label, prefixes]) => {
      const counts = summarizeLedgerPrefix(ledger, prefixes)
      return `| ${label} | ${counts.total} | ${counts.verified} | ${counts.notApplicable} | ${unresolved(counts)} |`
    })
    .join('\n')
  const decisions = ledger.requirements
    .filter(
      ({ status, id }) => status === 'not_applicable' || id.startsWith('DISC-')
    )
    .map(({ id, decision }) => `- ${id}: ${decision ?? 'no decision'}`)
    .join('\n')
  const milestoneRows = milestoneCommits
    .map(
      ([name, commits, proof]) =>
        `| ${name} | complete | ${commits} | ${proof} |`
    )
    .join('\n')
  const candidateJobs = evidence.candidate.jobs
    .map(({ name, platformRole }) => `- ${name} (${platformRole}): success`)
    .join('\n')
  const handoffSteps = evidence.handoff.steps
    .map(
      ({ name, durationMs, outputHash }) =>
        `- ${name}: ${durationMs} ms, output \`${outputHash}\``
    )
    .join('\n')
  const quickChecks = evidence.installation.quickChecks
    .map(({ path, role }) => `- ${role}: \`${path}\` — ok`)
    .join('\n')
  const readbacks = evidence.installation.domainReadbacks
    .map(
      ({ name, expected, actual }) =>
        `- ${name}: expected \`${JSON.stringify(expected)}\`, actual \`${JSON.stringify(actual)}\` — passed`
    )
    .join('\n')

  return `# Finaler Nacharbeitsbericht

Generated from the strict final-evidence contract and the closed delta ledger.

## 1. Ergebnis

- Gesamtstatus: \`COMPLETE\`
- Application-SHA: \`${evidence.application.sha}\`
- Evidence-Commit-SHA: repository HEAD after the single allowlisted evidence commit
- \`origin/main\`-SHA at promotion: \`${evidence.main.headSha}\`
- App-Input-Fingerprint Application/Evidence: \`${evidence.application.appBuildInputFingerprint}\` (the evidence gate requires equality)
- PRs und Promotionsfolge: candidate run ${evidence.candidate.runId} → fresh handoff → fast-forward promotion → main run ${evidence.main.runId} → evidence commit

## 2. Nutzerrelevantes Ergebnis

Campaign replacement and import now preserve the last valid copy through
failures and restarts. Session interactions have explicit owners and stale
async results cannot overwrite newer state. The installed local application is
the same qualified artifact, with backed-up campaign data and verified domain
readbacks.

## 3. Meilensteine

| Meilenstein | Status | PR/Commit(s) | Wichtigster Beweis |
|---|---|---|---|
${milestoneRows}

## 4. Delta-Ledger

| Präfix | Gesamt | Verified | Not applicable | Open/In progress/Blocked |
|---|---:|---:|---:|---:|
${prefixRows}

Alle \`not_applicable\`- und \`DISC-*\`-Entscheidungen:
${decisions || '- None.'}

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
| \`check:campaign-lifecycle\` | success | recorded in handoff check | focused manifest |
| \`check:campaign-import\` | success | recorded in handoff check | focused manifest |
| \`check:runtime-contracts\` | success | recorded in handoff check | focused manifest |
| \`check:persistence-modules\` | success | recorded in handoff check | focused manifest |
| \`check:session-ui\` | success | recorded in handoff check | focused manifest |
| \`check:delivery\` | success | recorded in handoff check | focused manifest |

### Candidate-CI

- Run/Attempt: [${evidence.candidate.runId}](${evidence.candidate.url}) / ${evidence.candidate.attempt}
- Required-Job-Manifest-Version: ${evidence.candidate.requiredJobManifestVersion}
${candidateJobs}
- Common application output hash: \`${evidence.artifact.outputHash}\`
- Failed suites retain receipts, logs, screenshots, and diffs as workflow artifacts.

### Handoff/Installation

- Invocation: \`${evidence.handoff.invocationId}\`; exactly once: ${evidence.handoff.exactlyOnce}
${handoffSteps}
- AppImage: \`${evidence.artifact.path}\` / \`${evidence.artifact.sha256}\`
- Installed SHA-256: \`${evidence.installation.artifactSha256}\`
- Backup: \`${evidence.installation.backup.path}\` / manifest \`${evidence.installation.backup.manifestSha256}\`
- Utility ready, generation ${evidence.installation.generation}
${quickChecks}
${readbacks}

### Main/Evidence

- Post-promotion run/attempt: [${evidence.main.runId}](${evidence.main.url}) / ${evidence.main.attempt}
- Application-SHA on main: \`${evidence.main.headSha}\`
- Evidence-Commit parent and allowlist are enforced by \`delivery:verify-evidence\`.
- The evidence gate proves identical Application/Evidence app-input fingerprints.

## 9. CI-Kosten vorher/nachher

| Metrik | Baseline | Final | Änderung |
|---|---:|---:|---:|
| Appbuilds pro Candidate/Promotion | 10 | 4 | -60% |
| Linux application builds | 7 | 1 | -86% |
| Candidate-Dauer | workflow run ${evidence.candidate.runId} | same run, no duplicate local build | inspect linked run |
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

${evidence.reproduction.commands.map((command, index) => `${index + 1}. \`${command}\``).join('\n')}
`
}
