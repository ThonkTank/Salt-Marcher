package src.domain.sessionplanner.published;

public record SessionPlannerEncounterCommand(Action action, long encounterId) {

    public SessionPlannerEncounterCommand {
        action = action == null ? Action.SELECT : action;
        encounterId = Math.max(0L, encounterId);
    }

    public enum Action {
        SELECT,
        REMOVE,
        MOVE_UP,
        MOVE_DOWN
    }
}
