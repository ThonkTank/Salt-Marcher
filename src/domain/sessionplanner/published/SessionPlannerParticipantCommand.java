package src.domain.sessionplanner.published;

public record SessionPlannerParticipantCommand(Action action, long characterId) implements SessionPlannerCommand {

    public SessionPlannerParticipantCommand {
        action = action == null ? Action.ADD : action;
        characterId = Math.max(0L, characterId);
    }

    public enum Action {
        ADD,
        REMOVE
    }
}
