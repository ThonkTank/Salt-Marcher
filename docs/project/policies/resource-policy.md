Status: Active
Owner: Aaron
Last Reviewed: 2026-07-05
Source of Truth: One-time resource policy for autonomous SaltMarcher delivery.

# Resource Policy

## Paid Services

No paid service may be enabled autonomously. The approved paid service is
Anthropic API usage for `judge-review`. The repository does not add a separate
daily call cap; the configured provider/account subscription limits are the
usage boundary.

Judge activation requires this policy to be signed off once by the owner and
either `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` to be set in GitHub
Actions. Until then, R1+ judge review fails closed with an owner action.

Initial owner approval is confirmed by direct owner instruction on 2026-07-05.
No separate fixed-phrase PR comment is required.

## External Services

Approved services are GitHub, the Anthropic API for judge review, SonarCloud,
and CodeScene. SonarCloud and CodeScene are pre-existing analysis services and
remain subject to the monthly pruning review.

Adding any other external endpoint is outside policy and requires an owner
question with recommendation, default, and no-action behavior.

## Data Egress

PR diffs and repository metadata may be sent to the judge API. Real local user
data, including SQLite database contents, must never leave the machine.

## Secrets

Agents never create, rotate, print, or move secrets. They may request secret
setup as owner actions.

## Changes

Changing this policy is R3c and requires the gate-change procedure.
