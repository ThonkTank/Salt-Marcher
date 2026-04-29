package src.view.statetabs.encounter;

public record EncounterCombatPartyMemberPopupStateViewInputEvent(
        long memberId,
        int initiative
) {
}
