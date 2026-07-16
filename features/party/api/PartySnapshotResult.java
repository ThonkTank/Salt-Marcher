package features.party.api;

public record PartySnapshotResult(
        ReadStatus status,
        PartySnapshot snapshot
) {
}
