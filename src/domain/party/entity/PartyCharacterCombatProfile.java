package src.domain.party.entity;

public record PartyCharacterCombatProfile(
        int passivePerception,
        int armorClass
) {
    public PartyCharacterCombatProfile {
        passivePerception = clampStat(passivePerception);
        armorClass = clampStat(armorClass);
    }

    private static int clampStat(int value) {
        return Math.max(1, Math.min(99, value));
    }
}
