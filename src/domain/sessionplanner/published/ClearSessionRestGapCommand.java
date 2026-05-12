package src.domain.sessionplanner.published;

public record ClearSessionRestGapCommand(
        long leftEncounterId,
        long rightEncounterId
) {

    public ClearSessionRestGapCommand {
        leftEncounterId = Math.max(0L, leftEncounterId);
        rightEncounterId = Math.max(0L, rightEncounterId);
    }
}
