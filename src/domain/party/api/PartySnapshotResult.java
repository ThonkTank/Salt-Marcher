package src.domain.party.api;

public record PartySnapshotResult(
        ReadStatus status,
        PartySnapshot snapshot
) {
}
