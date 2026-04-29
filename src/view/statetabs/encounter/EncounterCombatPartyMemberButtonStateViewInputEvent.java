package src.view.statetabs.encounter;

public record EncounterCombatPartyMemberButtonStateViewInputEvent(
        long memberId,
        int initiative
) {
}
