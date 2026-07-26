Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-25
Source of Truth: Entry point and document map for the Campaign registry feature.

# Campaign Feature README

The Campaign feature owns the installation-wide Campaign registry and durable
active-Campaign pointer. User-visible Campaign behavior remains in the program
requirements; persistence shape and failure semantics are owned by the
[Campaign Registry Persistence Contract](contract/contract-campaign-registry-persistence.md).
