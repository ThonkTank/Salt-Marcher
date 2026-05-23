package src.domain.sessionplanner.published;

public record SessionPlannerParticipantCommand(Action action, long characterId) {

    public SessionPlannerParticipantCommand {
        action = action == null ? Action.ADD : action;
        characterId = Math.max(0L, characterId);
    }

    public static SessionPlannerParticipantCommand add(long characterId) {
        return new SessionPlannerParticipantCommand(Action.ADD, characterId);
    }

    public static SessionPlannerParticipantCommand remove(long characterId) {
        return new SessionPlannerParticipantCommand(Action.REMOVE, characterId);
    }

    public enum Action {
        ADD,
        REMOVE
    }
}
