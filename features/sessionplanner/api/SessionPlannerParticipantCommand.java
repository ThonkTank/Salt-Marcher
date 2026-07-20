package features.sessionplanner.api;

public record SessionPlannerParticipantCommand(
        SessionPlannerAuthoredTarget target,
        Action action,
        long characterId
) {

    public SessionPlannerParticipantCommand {
        if (target == null) {
            throw new IllegalArgumentException("authored target is required");
        }
        if (action == null) {
            throw new IllegalArgumentException("action is required");
        }
        if (characterId <= 0L) {
            throw new IllegalArgumentException("character id must be positive");
        }
    }

    public static SessionPlannerParticipantCommand add(SessionPlannerAuthoredTarget target, long characterId) {
        return new SessionPlannerParticipantCommand(target, Action.ADD, characterId);
    }

    public static SessionPlannerParticipantCommand remove(SessionPlannerAuthoredTarget target, long characterId) {
        return new SessionPlannerParticipantCommand(target, Action.REMOVE, characterId);
    }

    public enum Action {
        ADD,
        REMOVE
    }
}
