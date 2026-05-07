package src.domain.sessionplanner.published;

import java.math.BigDecimal;

public record ApplySessionPlannerCommand(
        Action action,
        SetSessionEncounterDaysCommand encounterDays,
        SessionPlannerParticipantRef participant,
        SessionPlannerEncounterPlanRef encounterPlan,
        SessionPlannerEncounterRef encounter,
        SessionPlannerEncounterAllocationCommand encounterAllocation,
        SessionPlannerRestGapChange restGap,
        SessionPlannerRestGapRef restGapRef,
        SessionPlannerLootRef loot
) {

    public enum Action {
        REFRESH_SESSION,
        CREATE_SESSION,
        ADD_PARTICIPANT,
        REMOVE_PARTICIPANT,
        SET_ENCOUNTER_DAYS,
        ATTACH_ENCOUNTER,
        REMOVE_ENCOUNTER,
        MOVE_ENCOUNTER_UP,
        MOVE_ENCOUNTER_DOWN,
        SET_ENCOUNTER_ALLOCATION,
        SELECT_ENCOUNTER,
        SET_REST_GAP,
        CLEAR_REST_GAP,
        ADD_LOOT_PLACEHOLDER,
        REMOVE_LOOT_PLACEHOLDER
    }

    public ApplySessionPlannerCommand {
        action = action == null ? Action.REFRESH_SESSION : action;
        encounterDays = encounterDays == null ? new SetSessionEncounterDaysCommand(BigDecimal.ONE) : encounterDays;
        participant = participant == null ? new SessionPlannerParticipantRef(0L) : participant;
        encounterPlan = encounterPlan == null ? new SessionPlannerEncounterPlanRef(0L) : encounterPlan;
        encounter = encounter == null ? new SessionPlannerEncounterRef(0L) : encounter;
        encounterAllocation = encounterAllocation == null
                ? new SessionPlannerEncounterAllocationCommand(0L, null)
                : encounterAllocation;
        restGap = restGap == null ? new SessionPlannerRestGapChange(0L, 0L, null) : restGap;
        restGapRef = restGapRef == null ? new SessionPlannerRestGapRef(0L, 0L) : restGapRef;
        loot = loot == null ? new SessionPlannerLootRef(0L) : loot;
    }

    public static ApplySessionPlannerCommand refresh() {
        return new ApplySessionPlannerCommand(Action.REFRESH_SESSION, null, null, null, null, null, null, null, null);
    }

    public static ApplySessionPlannerCommand createSession() {
        return new ApplySessionPlannerCommand(Action.CREATE_SESSION, null, null, null, null, null, null, null, null);
    }

    public static ApplySessionPlannerCommand addParticipant(SessionPlannerParticipantRef participant) {
        return new ApplySessionPlannerCommand(Action.ADD_PARTICIPANT, null, participant, null, null, null, null, null, null);
    }

    public static ApplySessionPlannerCommand removeParticipant(SessionPlannerParticipantRef participant) {
        return new ApplySessionPlannerCommand(Action.REMOVE_PARTICIPANT, null, participant, null, null, null, null, null, null);
    }

    public static ApplySessionPlannerCommand encounterDays(SetSessionEncounterDaysCommand encounterDays) {
        return new ApplySessionPlannerCommand(Action.SET_ENCOUNTER_DAYS, encounterDays, null, null, null, null, null, null, null);
    }

    public static ApplySessionPlannerCommand attachEncounter(SessionPlannerEncounterPlanRef encounterPlan) {
        return new ApplySessionPlannerCommand(Action.ATTACH_ENCOUNTER, null, null, encounterPlan, null, null, null, null, null);
    }

    public static ApplySessionPlannerCommand removeEncounter(SessionPlannerEncounterRef encounter) {
        return new ApplySessionPlannerCommand(Action.REMOVE_ENCOUNTER, null, null, null, encounter, null, null, null, null);
    }

    public static ApplySessionPlannerCommand moveEncounterUp(SessionPlannerEncounterRef encounter) {
        return new ApplySessionPlannerCommand(Action.MOVE_ENCOUNTER_UP, null, null, null, encounter, null, null, null, null);
    }

    public static ApplySessionPlannerCommand moveEncounterDown(SessionPlannerEncounterRef encounter) {
        return new ApplySessionPlannerCommand(Action.MOVE_ENCOUNTER_DOWN, null, null, null, encounter, null, null, null, null);
    }

    public static ApplySessionPlannerCommand allocation(SessionPlannerEncounterAllocationCommand encounterAllocation) {
        return new ApplySessionPlannerCommand(Action.SET_ENCOUNTER_ALLOCATION, null, null, null, null, encounterAllocation, null, null, null);
    }

    public static ApplySessionPlannerCommand selectEncounter(SessionPlannerEncounterRef encounter) {
        return new ApplySessionPlannerCommand(Action.SELECT_ENCOUNTER, null, null, null, encounter, null, null, null, null);
    }

    public static ApplySessionPlannerCommand restGap(SessionPlannerRestGapChange restGap) {
        return restGap.restKind().clearsRestGap()
                ? clearRestGap(new SessionPlannerRestGapRef(restGap.leftEncounterId(), restGap.rightEncounterId()))
                : new ApplySessionPlannerCommand(Action.SET_REST_GAP, null, null, null, null, null, restGap, null, null);
    }

    public static ApplySessionPlannerCommand clearRestGap(SessionPlannerRestGapRef restGapRef) {
        return new ApplySessionPlannerCommand(Action.CLEAR_REST_GAP, null, null, null, null, null, null, restGapRef, null);
    }

    public static ApplySessionPlannerCommand addLootPlaceholder() {
        return new ApplySessionPlannerCommand(Action.ADD_LOOT_PLACEHOLDER, null, null, null, null, null, null, null, null);
    }

    public static ApplySessionPlannerCommand removeLoot(SessionPlannerLootRef loot) {
        return new ApplySessionPlannerCommand(Action.REMOVE_LOOT_PLACEHOLDER, null, null, null, null, null, null, null, loot);
    }
}
