package src.domain.party.published;

public record PartySnapshotResult(
        ReadStatus status,
        PartySnapshot snapshot
) {
}
