package src.view.statetabs.encounter;

public record EncounterCombatStateViewInputEvent(
        boolean nextTurnRequested,
        String combatantId,
        int hpDelta,
        boolean healing,
        boolean initiativeChangeRequested,
        int initiativeValue,
        long partyMemberId,
        boolean endCombatRequested
) {

    public EncounterCombatStateViewInputEvent {
        combatantId = combatantId == null ? "" : combatantId;
        partyMemberId = Math.max(0L, partyMemberId);
    }
}
