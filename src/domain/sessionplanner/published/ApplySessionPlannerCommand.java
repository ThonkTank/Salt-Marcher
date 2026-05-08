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

    private static final SetSessionEncounterDaysCommand DEFAULT_ENCOUNTER_DAYS =
            new SetSessionEncounterDaysCommand(BigDecimal.ONE);
    private static final SessionPlannerParticipantRef DEFAULT_PARTICIPANT = new SessionPlannerParticipantRef(0L);
    private static final SessionPlannerEncounterPlanRef DEFAULT_ENCOUNTER_PLAN = new SessionPlannerEncounterPlanRef(0L);
    private static final SessionPlannerEncounterRef DEFAULT_ENCOUNTER = new SessionPlannerEncounterRef(0L);
    private static final SessionPlannerEncounterAllocationCommand DEFAULT_ENCOUNTER_ALLOCATION =
            new SessionPlannerEncounterAllocationCommand(0L, BigDecimal.ZERO);
    private static final SessionPlannerRestGapChange DEFAULT_REST_GAP =
            new SessionPlannerRestGapChange(0L, 0L, SessionPlannerRestKind.NONE);
    private static final SessionPlannerRestGapRef DEFAULT_REST_GAP_REF = new SessionPlannerRestGapRef(0L, 0L);
    private static final SessionPlannerLootRef DEFAULT_LOOT = new SessionPlannerLootRef(0L);

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
        encounterDays = encounterDays == null ? DEFAULT_ENCOUNTER_DAYS : encounterDays;
        participant = participant == null ? DEFAULT_PARTICIPANT : participant;
        encounterPlan = encounterPlan == null ? DEFAULT_ENCOUNTER_PLAN : encounterPlan;
        encounter = encounter == null ? DEFAULT_ENCOUNTER : encounter;
        encounterAllocation = encounterAllocation == null ? DEFAULT_ENCOUNTER_ALLOCATION : encounterAllocation;
        restGap = restGap == null ? DEFAULT_REST_GAP : restGap;
        restGapRef = restGapRef == null ? DEFAULT_REST_GAP_REF : restGapRef;
        loot = loot == null ? DEFAULT_LOOT : loot;
    }

    public static ApplySessionPlannerCommand refresh() {
        return new ApplySessionPlannerCommand(
                Action.REFRESH_SESSION,
                DEFAULT_ENCOUNTER_DAYS,
                DEFAULT_PARTICIPANT,
                DEFAULT_ENCOUNTER_PLAN,
                DEFAULT_ENCOUNTER,
                DEFAULT_ENCOUNTER_ALLOCATION,
                DEFAULT_REST_GAP,
                DEFAULT_REST_GAP_REF,
                DEFAULT_LOOT);
    }

    public static ApplySessionPlannerCommand createSession() {
        return new ApplySessionPlannerCommand(
                Action.CREATE_SESSION,
                DEFAULT_ENCOUNTER_DAYS,
                DEFAULT_PARTICIPANT,
                DEFAULT_ENCOUNTER_PLAN,
                DEFAULT_ENCOUNTER,
                DEFAULT_ENCOUNTER_ALLOCATION,
                DEFAULT_REST_GAP,
                DEFAULT_REST_GAP_REF,
                DEFAULT_LOOT);
    }

    public static ApplySessionPlannerCommand addParticipant(SessionPlannerParticipantRef participant) {
        return new ApplySessionPlannerCommand(
                Action.ADD_PARTICIPANT,
                DEFAULT_ENCOUNTER_DAYS,
                participant,
                DEFAULT_ENCOUNTER_PLAN,
                DEFAULT_ENCOUNTER,
                DEFAULT_ENCOUNTER_ALLOCATION,
                DEFAULT_REST_GAP,
                DEFAULT_REST_GAP_REF,
                DEFAULT_LOOT);
    }

    public static ApplySessionPlannerCommand removeParticipant(SessionPlannerParticipantRef participant) {
        return new ApplySessionPlannerCommand(
                Action.REMOVE_PARTICIPANT,
                DEFAULT_ENCOUNTER_DAYS,
                participant,
                DEFAULT_ENCOUNTER_PLAN,
                DEFAULT_ENCOUNTER,
                DEFAULT_ENCOUNTER_ALLOCATION,
                DEFAULT_REST_GAP,
                DEFAULT_REST_GAP_REF,
                DEFAULT_LOOT);
    }

    public static ApplySessionPlannerCommand encounterDays(SetSessionEncounterDaysCommand encounterDays) {
        return new ApplySessionPlannerCommand(
                Action.SET_ENCOUNTER_DAYS,
                encounterDays,
                DEFAULT_PARTICIPANT,
                DEFAULT_ENCOUNTER_PLAN,
                DEFAULT_ENCOUNTER,
                DEFAULT_ENCOUNTER_ALLOCATION,
                DEFAULT_REST_GAP,
                DEFAULT_REST_GAP_REF,
                DEFAULT_LOOT);
    }

    public static ApplySessionPlannerCommand attachEncounter(SessionPlannerEncounterPlanRef encounterPlan) {
        return new ApplySessionPlannerCommand(
                Action.ATTACH_ENCOUNTER,
                DEFAULT_ENCOUNTER_DAYS,
                DEFAULT_PARTICIPANT,
                encounterPlan,
                DEFAULT_ENCOUNTER,
                DEFAULT_ENCOUNTER_ALLOCATION,
                DEFAULT_REST_GAP,
                DEFAULT_REST_GAP_REF,
                DEFAULT_LOOT);
    }

    public static ApplySessionPlannerCommand removeEncounter(SessionPlannerEncounterRef encounter) {
        return new ApplySessionPlannerCommand(
                Action.REMOVE_ENCOUNTER,
                DEFAULT_ENCOUNTER_DAYS,
                DEFAULT_PARTICIPANT,
                DEFAULT_ENCOUNTER_PLAN,
                encounter,
                DEFAULT_ENCOUNTER_ALLOCATION,
                DEFAULT_REST_GAP,
                DEFAULT_REST_GAP_REF,
                DEFAULT_LOOT);
    }

    public static ApplySessionPlannerCommand moveEncounterUp(SessionPlannerEncounterRef encounter) {
        return new ApplySessionPlannerCommand(
                Action.MOVE_ENCOUNTER_UP,
                DEFAULT_ENCOUNTER_DAYS,
                DEFAULT_PARTICIPANT,
                DEFAULT_ENCOUNTER_PLAN,
                encounter,
                DEFAULT_ENCOUNTER_ALLOCATION,
                DEFAULT_REST_GAP,
                DEFAULT_REST_GAP_REF,
                DEFAULT_LOOT);
    }

    public static ApplySessionPlannerCommand moveEncounterDown(SessionPlannerEncounterRef encounter) {
        return new ApplySessionPlannerCommand(
                Action.MOVE_ENCOUNTER_DOWN,
                DEFAULT_ENCOUNTER_DAYS,
                DEFAULT_PARTICIPANT,
                DEFAULT_ENCOUNTER_PLAN,
                encounter,
                DEFAULT_ENCOUNTER_ALLOCATION,
                DEFAULT_REST_GAP,
                DEFAULT_REST_GAP_REF,
                DEFAULT_LOOT);
    }

    public static ApplySessionPlannerCommand allocation(SessionPlannerEncounterAllocationCommand encounterAllocation) {
        return new ApplySessionPlannerCommand(
                Action.SET_ENCOUNTER_ALLOCATION,
                DEFAULT_ENCOUNTER_DAYS,
                DEFAULT_PARTICIPANT,
                DEFAULT_ENCOUNTER_PLAN,
                DEFAULT_ENCOUNTER,
                encounterAllocation,
                DEFAULT_REST_GAP,
                DEFAULT_REST_GAP_REF,
                DEFAULT_LOOT);
    }

    public static ApplySessionPlannerCommand selectEncounter(SessionPlannerEncounterRef encounter) {
        return new ApplySessionPlannerCommand(
                Action.SELECT_ENCOUNTER,
                DEFAULT_ENCOUNTER_DAYS,
                DEFAULT_PARTICIPANT,
                DEFAULT_ENCOUNTER_PLAN,
                encounter,
                DEFAULT_ENCOUNTER_ALLOCATION,
                DEFAULT_REST_GAP,
                DEFAULT_REST_GAP_REF,
                DEFAULT_LOOT);
    }

    public static ApplySessionPlannerCommand restGap(SessionPlannerRestGapChange restGap) {
        return restGap.restKind().clearsRestGap()
                ? clearRestGap(new SessionPlannerRestGapRef(restGap.leftEncounterId(), restGap.rightEncounterId()))
                : new ApplySessionPlannerCommand(
                        Action.SET_REST_GAP,
                        DEFAULT_ENCOUNTER_DAYS,
                        DEFAULT_PARTICIPANT,
                        DEFAULT_ENCOUNTER_PLAN,
                        DEFAULT_ENCOUNTER,
                        DEFAULT_ENCOUNTER_ALLOCATION,
                        restGap,
                        DEFAULT_REST_GAP_REF,
                        DEFAULT_LOOT);
    }

    public static ApplySessionPlannerCommand clearRestGap(SessionPlannerRestGapRef restGapRef) {
        return new ApplySessionPlannerCommand(
                Action.CLEAR_REST_GAP,
                DEFAULT_ENCOUNTER_DAYS,
                DEFAULT_PARTICIPANT,
                DEFAULT_ENCOUNTER_PLAN,
                DEFAULT_ENCOUNTER,
                DEFAULT_ENCOUNTER_ALLOCATION,
                DEFAULT_REST_GAP,
                restGapRef,
                DEFAULT_LOOT);
    }

    public static ApplySessionPlannerCommand addLootPlaceholder() {
        return new ApplySessionPlannerCommand(
                Action.ADD_LOOT_PLACEHOLDER,
                DEFAULT_ENCOUNTER_DAYS,
                DEFAULT_PARTICIPANT,
                DEFAULT_ENCOUNTER_PLAN,
                DEFAULT_ENCOUNTER,
                DEFAULT_ENCOUNTER_ALLOCATION,
                DEFAULT_REST_GAP,
                DEFAULT_REST_GAP_REF,
                DEFAULT_LOOT);
    }

    public static ApplySessionPlannerCommand removeLoot(SessionPlannerLootRef loot) {
        return new ApplySessionPlannerCommand(
                Action.REMOVE_LOOT_PLACEHOLDER,
                DEFAULT_ENCOUNTER_DAYS,
                DEFAULT_PARTICIPANT,
                DEFAULT_ENCOUNTER_PLAN,
                DEFAULT_ENCOUNTER,
                DEFAULT_ENCOUNTER_ALLOCATION,
                DEFAULT_REST_GAP,
                DEFAULT_REST_GAP_REF,
                loot);
    }
}
