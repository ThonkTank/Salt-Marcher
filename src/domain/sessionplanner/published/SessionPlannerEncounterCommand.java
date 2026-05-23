package src.domain.sessionplanner.published;

public record SessionPlannerEncounterCommand(Action action, long encounterId) {

    public SessionPlannerEncounterCommand {
        action = action == null ? Action.SELECT : action;
        encounterId = Math.max(0L, encounterId);
    }

    public static SessionPlannerEncounterCommand select(long encounterId) {
        return new SessionPlannerEncounterCommand(Action.SELECT, encounterId);
    }

    public static SessionPlannerEncounterCommand remove(long encounterId) {
        return new SessionPlannerEncounterCommand(Action.REMOVE, encounterId);
    }

    public static SessionPlannerEncounterCommand moveUp(long encounterId) {
        return new SessionPlannerEncounterCommand(Action.MOVE_UP, encounterId);
    }

    public static SessionPlannerEncounterCommand moveDown(long encounterId) {
        return new SessionPlannerEncounterCommand(Action.MOVE_DOWN, encounterId);
    }

    public enum Action {
        SELECT,
        REMOVE,
        MOVE_UP,
        MOVE_DOWN
    }
}
