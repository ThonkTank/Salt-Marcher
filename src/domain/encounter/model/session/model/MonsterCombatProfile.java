package src.domain.encounter.model.session.model;

import java.util.Locale;
import src.domain.encounter.model.session.model.CreatureDetailData;
import src.domain.encounter.model.session.model.EncounterCreatureData;

public record MonsterCombatProfile(
        long creatureId,
        String name,
        int maxHp,
        int armorClass,
        int xp,
        String detail
) {

    private static final String DEFAULT_ROLE = "Creature";

    public static MonsterCombatProfile fromEncounterCreature(EncounterCreatureData creature) {
        return new MonsterCombatProfile(
                creature.creatureId(),
                creature.name(),
                Math.max(1, creature.hp()),
                creature.armorClass(),
                creature.xp(),
                detail(creature.challengeRating(), creature.creatureType(), creature.encounterRole()));
    }

    public static MonsterCombatProfile fromReinforcement(CreatureDetailData creature, String role) {
        return new MonsterCombatProfile(
                creature.id(),
                creature.name(),
                Math.max(1, creature.hitPoints()),
                creature.armorClass(),
                creature.xp(),
                detail(creature.challengeRating(), creature.creatureType(), role));
    }

    private static String detail(String challengeRating, String creatureType, String role) {
        String normalizedRole = role == null || role.isBlank() ? DEFAULT_ROLE : role;
        String normalizedCr = challengeRating == null ? "" : challengeRating;
        String normalizedType = creatureType == null ? "" : creatureType;
        return "CR " + normalizedCr + " | " + normalizedType + " | " + normalizedRole.toLowerCase(Locale.ROOT);
    }
}
