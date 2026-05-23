package src.domain.sessionplanner.published;

public record SessionPlannerActionCommand(Action action) {

    public SessionPlannerActionCommand {
        action = action == null ? Action.CREATE_SESSION : action;
    }

    public static SessionPlannerActionCommand createSession() {
        return new SessionPlannerActionCommand(Action.CREATE_SESSION);
    }

    public static SessionPlannerActionCommand addLootPlaceholder() {
        return new SessionPlannerActionCommand(Action.ADD_LOOT_PLACEHOLDER);
    }

    public enum Action {
        CREATE_SESSION,
        ADD_LOOT_PLACEHOLDER
    }
}
