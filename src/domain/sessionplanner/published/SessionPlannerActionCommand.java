package src.domain.sessionplanner.published;

public record SessionPlannerActionCommand(Action action) {

    public SessionPlannerActionCommand {
        action = action == null ? Action.ADD_LOOT_PLACEHOLDER : action;
    }

    public static SessionPlannerActionCommand addLootPlaceholder() {
        return new SessionPlannerActionCommand(Action.ADD_LOOT_PLACEHOLDER);
    }

    public enum Action {
        ADD_LOOT_PLACEHOLDER
    }
}
