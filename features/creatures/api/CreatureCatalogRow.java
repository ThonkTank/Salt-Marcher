package features.creatures.api;

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

    public CreatureCatalogRow {
        name = name == null ? "" : name;
        size = size == null ? "" : size;
        creatureType = creatureType == null ? "" : creatureType;
        alignment = alignment == null ? "" : alignment;
        challengeRating = challengeRating == null ? "" : challengeRating;
    }
}
