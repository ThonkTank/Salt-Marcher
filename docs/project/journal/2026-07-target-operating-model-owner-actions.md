Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-05
Source of Truth: Owner-action checklist for the target operating model rollout.

# Target Operating Model Owner Actions

1. Create or update labels:

   ```bash
   tools/local/create-github-labels.sh
   ```

   Required labels: `risk:R0`, `risk:R1`, `risk:R2`, `risk:R3a`, `risk:R3b`,
   `risk:R3c`, `gate-change-approved`, `judge-override`, `abnahme-offen`,
   `abnahme-ok`, `abnahme-abgelehnt`, `owner-feedback`, `security`, `ux`.

2. Confirm label permission: GitHub -> Settings -> Collaborators and teams.
   Keep write/triage label rights limited to maintainers and trusted agents;
   only the owner applies `gate-change-approved` and `judge-override`.

3. Sign off `docs/project/policies/resource-policy.md` once with a GitHub
   comment containing `passt`.

4. Create the judge secret: GitHub -> Settings -> Secrets and variables ->
   Actions -> New repository secret -> name `ANTHROPIC_API_KEY`.

5. Configure branch protection: GitHub -> Settings -> Rules -> Rulesets or
   Branches -> Branch protection rules -> target `main`; require pull
   requests; disable force pushes and deletion; require these exact checks:
   `quality-platforms / production-handoff`,
   `quality-platforms / warden-freeze`,
   `quality-platforms / behavior-gate`,
   `quality-platforms / judge-review`.

6. Verify branch protection after saving:

   ```bash
   tools/quality/scripts/branch_protection_readback.py
   ```

   Done means the script prints `Status: Qualified`.

7. Verify German issue templates: GitHub -> Issues -> New issue. Open
   `Bugreport`, `Featurewunsch`, and `UX-Problem` once and confirm fields
   render; do not submit test issues unless needed.

8. Install the laptop updater:

   ```bash
   tools/local/install-updater.sh
   ```

   Optional for richer issue filing: run `gh auth login` on the laptop first.

## Live Readback 2026-07-05

- Branch protection: `Qualified`; `main` requires exactly
  `quality-platforms / production-handoff`,
  `quality-platforms / warden-freeze`, `quality-platforms / behavior-gate`,
  and `quality-platforms / judge-review`.
- Labels: all target operating model labels exist, including `ux` for the
  `UX-Problem` issue template.
- Label permissions: GitHub API readback shows one direct collaborator,
  `ThonkTank`, with `admin` rights and no repository teams. No broader
  write/triage team grant is visible to the authenticated actor.
- Resource policy signoff: no PR comment containing `passt` exists on PR
  `#360`; this remains an owner action because it signs off paid-service and
  data-egress policy.
- Judge secret: `ANTHROPIC_API_KEY` is configured; `judge-review` passed for
  PR `#360` after rerun.
- Laptop updater: installed; `saltmarcher-update.timer` is enabled and active.
- Status issue: created as GitHub issue `#361`.
- Issue templates: GitHub API readback returns `404` for
  `.github/ISSUE_TEMPLATE` on `main`, and returns `bugreport.yml`,
  `featurewunsch.yml`, `ux-problem.yml`, and `config.yml` on
  `codex/target-operating-model`. GitHub UI rendering still requires the
  templates to reach the default branch before the New Issue chooser can prove
  the productive render path.
