# Campaign Feature README

The Campaign feature owns the installation-wide Campaign registry and durable
active-Campaign pointer. User-visible Campaign behavior remains in the program
requirements; see
[Campaign Management Requirements](requirements/requirements-campaign-management.md).
Persistence shape and failure semantics are owned by the
[Campaign Registry Persistence Contract](contract/contract-campaign-registry-persistence.md).
