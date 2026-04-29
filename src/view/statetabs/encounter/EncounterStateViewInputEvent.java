package src.view.statetabs.encounter;

import java.util.List;

public record EncounterStateViewInputEvent(
        Kind kind,
        long planId,
        long creatureId,
        long undoToken,
        List<InitiativeEntry> initiatives,
        String combatantId,
        int value,
        long partyMemberId,
        boolean healing
) {

    public EncounterStateViewInputEvent {
        kind = kind == null ? Kind.GENERATE : kind;
        planId = Math.max(0L, planId);
        creatureId = Math.max(0L, creatureId);
        undoToken = Math.max(0L, undoToken);
        initiatives = initiatives == null ? List.of() : List.copyOf(initiatives);
        combatantId = combatantId == null ? "" : combatantId;
        partyMemberId = Math.max(0L, partyMemberId);
    }

    static EncounterStateViewInputEvent generate() {
        return new EncounterStateViewInputEvent(
                Kind.GENERATE,
                0L,
                0L,
                0L,
                List.of(),
                "",
                0,
                0L,
                false);
    }

    static EncounterStateViewInputEvent previousAlternative() {
        return new EncounterStateViewInputEvent(Kind.PREVIOUS_ALTERNATIVE,
                0L, 0L, 0L, List.of(), "", 0, 0L, false);
    }

    static EncounterStateViewInputEvent nextAlternative() {
        return new EncounterStateViewInputEvent(Kind.NEXT_ALTERNATIVE,
                0L, 0L, 0L, List.of(), "", 0, 0L, false);
    }

    static EncounterStateViewInputEvent saveEncounter() {
        return new EncounterStateViewInputEvent(Kind.SAVE_ENCOUNTER,
                0L, 0L, 0L, List.of(), "", 0, 0L, false);
    }

    static EncounterStateViewInputEvent openSavedEncounter(long planId) {
        return new EncounterStateViewInputEvent(Kind.OPEN_SAVED_ENCOUNTER,
                planId, 0L, 0L, List.of(), "", 0, 0L, false);
    }

    static EncounterStateViewInputEvent clearGenerationHistory() {
        return new EncounterStateViewInputEvent(Kind.CLEAR_GENERATION_HISTORY,
                0L, 0L, 0L, List.of(), "", 0, 0L, false);
    }

    static EncounterStateViewInputEvent rosterIncrement(long creatureId) {
        return new EncounterStateViewInputEvent(Kind.ROSTER_INCREMENT,
                0L, creatureId, 0L, List.of(), "", 0, 0L, false);
    }

    static EncounterStateViewInputEvent rosterDecrement(long creatureId) {
        return new EncounterStateViewInputEvent(Kind.ROSTER_DECREMENT,
                0L, creatureId, 0L, List.of(), "", 0, 0L, false);
    }

    static EncounterStateViewInputEvent rosterRemove(long creatureId) {
        return new EncounterStateViewInputEvent(Kind.ROSTER_REMOVE,
                0L, creatureId, 0L, List.of(), "", 0, 0L, false);
    }

    static EncounterStateViewInputEvent undoRemove(long undoToken) {
        return new EncounterStateViewInputEvent(Kind.UNDO_REMOVE,
                0L, 0L, undoToken, List.of(), "", 0, 0L, false);
    }

    static EncounterStateViewInputEvent openCreature(long creatureId) {
        return new EncounterStateViewInputEvent(Kind.OPEN_CREATURE,
                0L, creatureId, 0L, List.of(), "", 0, 0L, false);
    }

    static EncounterStateViewInputEvent startInitiative() {
        return new EncounterStateViewInputEvent(Kind.START_INITIATIVE,
                0L, 0L, 0L, List.of(), "", 0, 0L, false);
    }

    static EncounterStateViewInputEvent initiativeBack() {
        return new EncounterStateViewInputEvent(Kind.INITIATIVE_BACK,
                0L, 0L, 0L, List.of(), "", 0, 0L, false);
    }

    static EncounterStateViewInputEvent initiativeConfirm(List<InitiativeEntry> initiatives) {
        return new EncounterStateViewInputEvent(Kind.INITIATIVE_CONFIRM,
                0L, 0L, 0L, initiatives, "", 0, 0L, false);
    }

    static EncounterStateViewInputEvent nextTurn() {
        return new EncounterStateViewInputEvent(Kind.NEXT_TURN,
                0L, 0L, 0L, List.of(), "", 0, 0L, false);
    }

    static EncounterStateViewInputEvent damage(String combatantId, int amount) {
        return new EncounterStateViewInputEvent(Kind.DAMAGE,
                0L, 0L, 0L, List.of(), combatantId, amount, 0L, false);
    }

    static EncounterStateViewInputEvent heal(String combatantId, int amount) {
        return new EncounterStateViewInputEvent(Kind.HEAL,
                0L, 0L, 0L, List.of(), combatantId, amount, 0L, true);
    }

    static EncounterStateViewInputEvent setInitiative(String combatantId, int initiative) {
        return new EncounterStateViewInputEvent(Kind.SET_INITIATIVE,
                0L, 0L, 0L, List.of(), combatantId, initiative, 0L, false);
    }

    static EncounterStateViewInputEvent addPartyMemberToCombat(long partyMemberId, int initiative) {
        return new EncounterStateViewInputEvent(Kind.ADD_PARTY_MEMBER_TO_COMBAT,
                0L, 0L, 0L, List.of(), "", initiative, partyMemberId, false);
    }

    static EncounterStateViewInputEvent endCombat() {
        return new EncounterStateViewInputEvent(Kind.END_COMBAT,
                0L, 0L, 0L, List.of(), "", 0, 0L, false);
    }

    static EncounterStateViewInputEvent awardXp() {
        return new EncounterStateViewInputEvent(Kind.AWARD_XP,
                0L, 0L, 0L, List.of(), "", 0, 0L, false);
    }

    static EncounterStateViewInputEvent returnToBuilder() {
        return new EncounterStateViewInputEvent(Kind.RETURN_TO_BUILDER,
                0L, 0L, 0L, List.of(), "", 0, 0L, false);
    }

    enum Kind {
        GENERATE,
        PREVIOUS_ALTERNATIVE,
        NEXT_ALTERNATIVE,
        SAVE_ENCOUNTER,
        OPEN_SAVED_ENCOUNTER,
        CLEAR_GENERATION_HISTORY,
        ROSTER_INCREMENT,
        ROSTER_DECREMENT,
        ROSTER_REMOVE,
        UNDO_REMOVE,
        OPEN_CREATURE,
        START_INITIATIVE,
        INITIATIVE_BACK,
        INITIATIVE_CONFIRM,
        NEXT_TURN,
        DAMAGE,
        HEAL,
        SET_INITIATIVE,
        ADD_PARTY_MEMBER_TO_COMBAT,
        END_COMBAT,
        AWARD_XP,
        RETURN_TO_BUILDER
    }

    public record InitiativeEntry(String id, int initiative) {
    }
}
