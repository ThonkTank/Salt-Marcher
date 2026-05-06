package src.domain.sessionplanner.published;

public record SetSessionRestGapCommand(
        long leftEncounterId,
        long rightEncounterId,
        SessionPlannerRestKind restKind
) {

    public SetSessionRestGapCommand {
        leftEncounterId = Math.max(0L, leftEncounterId);
        rightEncounterId = Math.max(0L, rightEncounterId);
        restKind = restKind == null ? SessionPlannerRestKind.NONE : restKind;
    }
}
