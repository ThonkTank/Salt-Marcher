package src.domain.creatures.api;

public record CreatureCatalogRow(
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
