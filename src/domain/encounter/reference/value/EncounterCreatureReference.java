package src.domain.encounter.reference.value;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;

public record EncounterCreatureReference(
        long id,
        String name,
        String creatureType,
        String challengeRating,
        int xp,
        int hitPoints,
        @Nullable Integer hitDiceCount,
        @Nullable Integer hitDiceSides,
        @Nullable Integer hitDiceModifier,
        int armorClass,
        int initiativeBonus,
        int legendaryActionCount,
        int flySpeed,
        int swimSpeed,
        int climbSpeed,
        int burrowSpeed,
        @Nullable String damageResistances,
        @Nullable String damageImmunities,
        @Nullable String conditionImmunities,
        int passivePerception,
        List<String> actionTypes
) {

    public EncounterCreatureReference {
        name = name == null ? "" : name;
        creatureType = creatureType == null ? "" : creatureType;
        challengeRating = challengeRating == null ? "" : challengeRating;
        actionTypes = actionTypes == null ? List.of() : List.copyOf(actionTypes);
    }

    public static EncounterCreatureReference fromCatalogProfile(CreatureCatalogLookup.CreatureProfile detail) {
        if (detail == null) {
            return new EncounterCreatureReference(0L, "", "", "", 0, 0, null, null, null, 0, 0, 0, 0, 0, 0, 0, null, null, null, 0, List.of());
        }
        return new EncounterCreatureReference(
                detail.id(),
                detail.name(),
                detail.creatureType(),
                detail.challengeRating(),
                detail.xp(),
                detail.hitPoints(),
                detail.hitDiceCount(),
                detail.hitDiceSides(),
                detail.hitDiceModifier(),
                detail.armorClass(),
                detail.initiativeBonus(),
                detail.legendaryActionCount(),
                detail.flySpeed(),
                detail.swimSpeed(),
                detail.climbSpeed(),
                detail.burrowSpeed(),
                detail.damageResistances(),
                detail.damageImmunities(),
                detail.conditionImmunities(),
                detail.passivePerception(),
                detail.actions().stream().map(CreatureCatalogLookup.ActionProfile::actionType).toList());
    }
}
