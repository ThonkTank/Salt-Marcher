package src.view.statetabs.encounter;

public record EncounterResultsStateViewInputEvent(Action action) {

    public EncounterResultsStateViewInputEvent {
        action = action == null ? Action.AWARD_XP : action;
    }

    public boolean awardExperienceRequested() {
        return action == Action.AWARD_XP;
    }

    public enum Action {
        AWARD_XP,
        RETURN_TO_BUILDER
    }
}
