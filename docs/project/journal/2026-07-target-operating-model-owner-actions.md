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
   `abnahme-ok`, `abnahme-abgelehnt`, `owner-feedback`, `security`.

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

- Branch protection: `Not Qualified`; GitHub reported `main` is not protected.
- Labels: all target operating model labels are currently missing.
- Agent write attempt for labels was rejected by the approval reviewer; label
  creation remains an owner action.
