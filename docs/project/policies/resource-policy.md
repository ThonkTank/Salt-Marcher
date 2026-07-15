Status: Active
Owner: Aaron
Last Reviewed: 2026-07-15
Source of Truth: SaltMarcher cost, external-service, data-egress, and secret boundaries.

# Resource Policy

## Boundaries

- GitHub is the repository, pull-request, CI, issue, and release service.
- Do not enable or spend money on another service without owner approval.
- Do not send real local user data outside the machine.
- Do not create, rotate, print, move, or disclose secrets.
- Repository source may leave the machine only through the owner-approved
  GitHub repository workflow.

External review and analyzer services are not approved or required SaltMarcher
verification services.
