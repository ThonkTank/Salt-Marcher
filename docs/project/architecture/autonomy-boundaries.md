Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Autonomous technical decisions and owner-only safety boundaries.

# Autonomy Boundaries

## Technical Work

Agents decide architecture, refactoring, dependencies, test structure, CI,
documentation structure, performance work, and cleanup without owner approval.
Clear requests proceed directly; red checks and review findings are repair
inputs, not reasons to create another process layer.

## Owner Boundaries

Ask the owner only for:

- stable acceptance of owner-visible behavior;
- consent before changing real local user data;
- enabling or spending money on a service;
- creating, moving, rotating, or disclosing secrets;
- external transmission outside the resource policy.

Reversible technical work uses a feature branch, pull request, and the required
green `check`. No additional approval taxonomy or role ceremony is required.

## Safety

Never modify real local data without a restore-tested backup, transmit it,
enable a paid service, expose a secret, or bypass branch protection. Owner
acceptance cannot be replaced by automated review.
