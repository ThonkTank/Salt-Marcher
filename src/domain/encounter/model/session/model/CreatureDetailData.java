package src.domain.encounter.model.session.model;

public record CreatureDetailData(
        long id,
        String name,
        String challengeRating,
        int xp,
        int hitPoints,
        int armorClass,
        int initiativeBonus,
        String creatureType
) {
    public CreatureDetailData {
        name = name == null ? "" : name;
        challengeRating = challengeRating == null ? "" : challengeRating;
        creatureType = creatureType == null ? "" : creatureType;
    }
}
