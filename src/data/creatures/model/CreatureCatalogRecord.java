package src.data.creatures.model;

public record CreatureCatalogRecord(
        Identity identity,
        CombatStats combatStats
) {

    public record Identity(
            long id,
            String name,
            String size,
            String creatureType,
            String alignment
    ) {
    }

    public record CombatStats(
            String challengeRating,
            int xp,
            int hitPoints,
            int armorClass
    ) {
    }
}
