package src.data.creatures.model;

public record CreatureCatalogRecord(
        long id,
        String name,
        String size,
        String creatureType,
        String alignment,
        String challengeRating,
        int xp,
        int hitPoints,
        int armorClass
) {
}
