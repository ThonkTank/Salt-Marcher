package features.sessionplanner.api;

public record SessionPlannerEncounterCommand(
        SessionPlannerAuthoredTarget target,
        Action action,
        long encounterId
) {

    public SessionPlannerEncounterCommand {
        if (target == null) {
            throw new IllegalArgumentException("authored target is required");
        }
        if (action == null) {
            throw new IllegalArgumentException("action is required");
        }
        if (encounterId <= 0L) {
            throw new IllegalArgumentException("scene id must be positive");
        }
    }

    public static SessionPlannerEncounterCommand select(SessionPlannerAuthoredTarget target, long encounterId) {
        return new SessionPlannerEncounterCommand(target, Action.SELECT, encounterId);
    }

    public static SessionPlannerEncounterCommand remove(SessionPlannerAuthoredTarget target, long encounterId) {
        return new SessionPlannerEncounterCommand(target, Action.REMOVE, encounterId);
    }

    public static SessionPlannerEncounterCommand moveUp(SessionPlannerAuthoredTarget target, long encounterId) {
        return new SessionPlannerEncounterCommand(target, Action.MOVE_UP, encounterId);
    }

    public static SessionPlannerEncounterCommand moveDown(SessionPlannerAuthoredTarget target, long encounterId) {
        return new SessionPlannerEncounterCommand(target, Action.MOVE_DOWN, encounterId);
    }

    public enum Action {
        SELECT,
        REMOVE,
        MOVE_UP,
        MOVE_DOWN
    }
}
