package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.Objects;

public record SessionPlannerPublishedEvent(
        Kind kind,
        long characterId,
        long planId,
        long encounterToken,
        long leftEncounterId,
        long rightEncounterId,
        RestSelection restSelection,
        BigDecimal encounterDays,
        BigDecimal budgetPercentage,
        long lootToken
) {

    public SessionPlannerPublishedEvent {
        Objects.requireNonNull(kind, "kind");
        characterId = Math.max(0L, characterId);
        planId = Math.max(0L, planId);
        encounterToken = Math.max(0L, encounterToken);
        leftEncounterId = Math.max(0L, leftEncounterId);
        rightEncounterId = Math.max(0L, rightEncounterId);
        restSelection = restSelection == null ? RestSelection.NONE : restSelection;
        encounterDays = encounterDays == null ? BigDecimal.ONE : encounterDays;
        budgetPercentage = budgetPercentage == null ? BigDecimal.ZERO : budgetPercentage;
        lootToken = Math.max(0L, lootToken);
    }

    static SessionPlannerPublishedEvent refresh() {
        return new SessionPlannerPublishedEvent(Kind.REFRESH_SESSION, 0L, 0L, 0L, 0L, 0L, RestSelection.NONE, BigDecimal.ONE, BigDecimal.ZERO, 0L);
    }

    static SessionPlannerPublishedEvent createSession() {
        return new SessionPlannerPublishedEvent(Kind.CREATE_SESSION, 0L, 0L, 0L, 0L, 0L, RestSelection.NONE, BigDecimal.ONE, BigDecimal.ZERO, 0L);
    }

    static SessionPlannerPublishedEvent addParticipant(long characterId) {
        return new SessionPlannerPublishedEvent(Kind.ADD_PARTICIPANT, characterId, 0L, 0L, 0L, 0L, RestSelection.NONE, BigDecimal.ONE, BigDecimal.ZERO, 0L);
    }

    static SessionPlannerPublishedEvent removeParticipant(long characterId) {
        return new SessionPlannerPublishedEvent(Kind.REMOVE_PARTICIPANT, characterId, 0L, 0L, 0L, 0L, RestSelection.NONE, BigDecimal.ONE, BigDecimal.ZERO, 0L);
    }

    static SessionPlannerPublishedEvent setEncounterDays(BigDecimal encounterDays) {
        return new SessionPlannerPublishedEvent(Kind.SET_ENCOUNTER_DAYS, 0L, 0L, 0L, 0L, 0L, RestSelection.NONE, encounterDays, BigDecimal.ZERO, 0L);
    }

    static SessionPlannerPublishedEvent attachPlan(long planId) {
        return new SessionPlannerPublishedEvent(Kind.ATTACH_PLAN, 0L, planId, 0L, 0L, 0L, RestSelection.NONE, BigDecimal.ONE, BigDecimal.ZERO, 0L);
    }

    static SessionPlannerPublishedEvent removeEncounter(long encounterToken) {
        return new SessionPlannerPublishedEvent(Kind.REMOVE_ENCOUNTER, 0L, 0L, encounterToken, 0L, 0L, RestSelection.NONE, BigDecimal.ONE, BigDecimal.ZERO, 0L);
    }

    static SessionPlannerPublishedEvent moveEncounterUp(long encounterToken) {
        return new SessionPlannerPublishedEvent(Kind.MOVE_ENCOUNTER_UP, 0L, 0L, encounterToken, 0L, 0L, RestSelection.NONE, BigDecimal.ONE, BigDecimal.ZERO, 0L);
    }

    static SessionPlannerPublishedEvent moveEncounterDown(long encounterToken) {
        return new SessionPlannerPublishedEvent(Kind.MOVE_ENCOUNTER_DOWN, 0L, 0L, encounterToken, 0L, 0L, RestSelection.NONE, BigDecimal.ONE, BigDecimal.ZERO, 0L);
    }

    static SessionPlannerPublishedEvent selectEncounter(long encounterToken) {
        return new SessionPlannerPublishedEvent(Kind.SELECT_ENCOUNTER, 0L, 0L, encounterToken, 0L, 0L, RestSelection.NONE, BigDecimal.ONE, BigDecimal.ZERO, 0L);
    }

    static SessionPlannerPublishedEvent setEncounterAllocation(long encounterToken, BigDecimal budgetPercentage) {
        return new SessionPlannerPublishedEvent(Kind.SET_ENCOUNTER_ALLOCATION, 0L, 0L, encounterToken, 0L, 0L, RestSelection.NONE, BigDecimal.ONE, budgetPercentage, 0L);
    }

    static SessionPlannerPublishedEvent setRestGap(
            long leftEncounterId,
            long rightEncounterId,
            RestSelection restSelection
    ) {
        return new SessionPlannerPublishedEvent(
                Kind.SET_REST_GAP,
                0L,
                0L,
                0L,
                leftEncounterId,
                rightEncounterId,
                restSelection,
                BigDecimal.ONE,
                BigDecimal.ZERO,
                0L);
    }

    static SessionPlannerPublishedEvent clearRestGap(long leftEncounterId, long rightEncounterId) {
        return new SessionPlannerPublishedEvent(
                Kind.CLEAR_REST_GAP,
                0L,
                0L,
                0L,
                leftEncounterId,
                rightEncounterId,
                RestSelection.NONE,
                BigDecimal.ONE,
                BigDecimal.ZERO,
                0L);
    }

    static SessionPlannerPublishedEvent addLootPlaceholder() {
        return new SessionPlannerPublishedEvent(Kind.ADD_LOOT_PLACEHOLDER, 0L, 0L, 0L, 0L, 0L, RestSelection.NONE, BigDecimal.ONE, BigDecimal.ZERO, 0L);
    }

    static SessionPlannerPublishedEvent removeLootPlaceholder(long lootToken) {
        return new SessionPlannerPublishedEvent(Kind.REMOVE_LOOT_PLACEHOLDER, 0L, 0L, 0L, 0L, 0L, RestSelection.NONE, BigDecimal.ONE, BigDecimal.ZERO, lootToken);
    }

    enum Kind {
        REFRESH_SESSION,
        CREATE_SESSION,
        ADD_PARTICIPANT,
        REMOVE_PARTICIPANT,
        SET_ENCOUNTER_DAYS,
        ATTACH_PLAN,
        REMOVE_ENCOUNTER,
        MOVE_ENCOUNTER_UP,
        MOVE_ENCOUNTER_DOWN,
        SELECT_ENCOUNTER,
        SET_ENCOUNTER_ALLOCATION,
        SET_REST_GAP,
        CLEAR_REST_GAP,
        ADD_LOOT_PLACEHOLDER,
        REMOVE_LOOT_PLACEHOLDER
    }

    enum RestSelection {
        NONE,
        SHORT_REST,
        LONG_REST
    }
}
