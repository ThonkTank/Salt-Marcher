# Campaign Feature README

Status: Active migration index
Owner: Campaign
Last Reviewed: 2026-07-27
Source of Truth: Linked owner documents

The Campaign feature owns the installation-wide Campaign registry and durable
active-Campaign pointer. Its persistence boundary also atomically selects the
installation-wide Shared-Definition generation used by Campaign references.
User-visible Campaign behavior remains in the program requirements;
persistence shape and failure semantics are owned by the
[Campaign Registry Persistence Contract](contract/contract-campaign-registry-persistence.md).
