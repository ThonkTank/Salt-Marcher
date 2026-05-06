package src.view.leftbartabs.sessionplanner;

public record SessionPlannerControlsViewInputEvent(
        Kind kind,
        long characterId,
        long selectedPlanId,
        String encounterDaysText
) {

    public SessionPlannerControlsViewInputEvent {
        kind = kind == null ? Kind.REFRESH : kind;
        characterId = Math.max(0L, characterId);
        selectedPlanId = Math.max(0L, selectedPlanId);
        encounterDaysText = encounterDaysText == null ? "" : encounterDaysText.trim();
    }

    enum Kind {
        REFRESH,
        CREATE_SESSION,
        ADD_PARTICIPANT,
        REMOVE_PARTICIPANT,
        SET_ENCOUNTER_DAYS,
        ATTACH_PLAN
    }
}
