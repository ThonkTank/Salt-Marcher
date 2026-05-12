package src.domain.sessionplanner.published;

public record SessionPlannerActionCommand(Action action) implements SessionPlannerCommand {

    public SessionPlannerActionCommand {
        action = action == null ? Action.CREATE_SESSION : action;
    }

    public enum Action {
        CREATE_SESSION,
        ADD_LOOT_PLACEHOLDER
    }
}
