package src.domain.encounter.model.reference.model;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;
import src.domain.encounter.model.generation.model.EncounterCreatureFacts;

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
        return new CatalogProfileProjection(detail).toReference();
    }

    public EncounterCreatureFacts toFacts() {
        CombatProjection combat = combat();
        MovementProjection movement = movement();
        ResistanceProjection resistances = resistances();
        return new EncounterCreatureFacts(
                id,
                name,
                creatureType,
                challengeRating,
                xp,
                combat.hitPoints(),
                combat.hitDiceCount(),
                combat.hitDiceSides(),
                combat.hitDiceModifier(),
                combat.armorClass(),
                combat.initiativeBonus(),
                combat.legendaryActionCount(),
                movement.flySpeed(),
                movement.swimSpeed(),
                movement.climbSpeed(),
                movement.burrowSpeed(),
                resistances.damageResistances(),
                resistances.damageImmunities(),
                resistances.conditionImmunities(),
                passivePerception,
                toActionFacts());
    }

    private CombatProjection combat() {
        return new CombatProjection(
                hitPoints,
                hitDiceCount,
                hitDiceSides,
                hitDiceModifier,
                armorClass,
                initiativeBonus,
                legendaryActionCount);
    }

    private MovementProjection movement() {
        return new MovementProjection(flySpeed, swimSpeed, climbSpeed, burrowSpeed);
    }

    private ResistanceProjection resistances() {
        return new ResistanceProjection(damageResistances, damageImmunities, conditionImmunities);
    }

    private List<EncounterCreatureFacts.ActionFacts> toActionFacts() {
        return actionTypes.stream()
                .map(EncounterCreatureFacts.ActionFacts::new)
                .toList();
    }

    private record CombatProjection(
            int hitPoints,
            @Nullable Integer hitDiceCount,
            @Nullable Integer hitDiceSides,
            @Nullable Integer hitDiceModifier,
            int armorClass,
            int initiativeBonus,
            int legendaryActionCount
    ) {
    }

    private record MovementProjection(
            int flySpeed,
            int swimSpeed,
            int climbSpeed,
            int burrowSpeed
    ) {
    }

    private record ResistanceProjection(
            @Nullable String damageResistances,
            @Nullable String damageImmunities,
            @Nullable String conditionImmunities
    ) {
    }

    private static final class CatalogProfileProjection {

        private final CreatureCatalogLookup.CreatureProfile detail;

        private CatalogProfileProjection(CreatureCatalogLookup.CreatureProfile detail) {
            this.detail = detail;
        }

        private EncounterCreatureReference toReference() {
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
                    detail.actions().stream()
                            .map(action -> action.actionType())
                            .toList());
        }
    }
}
