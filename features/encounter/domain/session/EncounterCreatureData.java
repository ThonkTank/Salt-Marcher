package features.encounter.domain.session;

import java.util.List;

public record EncounterCreatureData(
        String id,
        long creatureId,
        long worldNpcId,
        String name,
        String challengeRating,
        int xp,
        int hp,
        int armorClass,
        int initiativeBonus,
        String creatureType,
        String encounterRole,
        int count,
        List<String> tags
) {

    private static final String DEFAULT_ROLE = "Creature";

    public EncounterCreatureData {
        id = id == null ? "" : id;
        worldNpcId = Math.max(0L, worldNpcId);
        name = name == null ? "" : name;
        challengeRating = challengeRating == null ? "" : challengeRating;
        creatureType = creatureType == null ? "" : creatureType;
        encounterRole = encounterRole == null || encounterRole.isBlank() ? DEFAULT_ROLE : encounterRole;
        count = worldNpcId > 0L ? 1 : Math.max(1, count);
        tags = tags == null ? List.of() : List.copyOf(tags);
    }

    public int totalXp() {
        return xp * count;
    }

    public EncounterCreatureData withCount(int nextCount, int maxCount) {
        return new EncounterCreatureData(
                id,
                creatureId,
                worldNpcId,
                name,
                challengeRating,
                xp,
                hp,
                armorClass,
                initiativeBonus,
                creatureType,
                encounterRole,
                worldNpcId > 0L ? 1 : Math.max(1, Math.min(maxCount, nextCount)),
                tags);
    }
}
