package src.domain.encounter.model.reference;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.EncounterCreatureFacts;

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
        List<EncounterCreatureFacts.ActionFacts> facts = new java.util.ArrayList<>(actionTypes.size());
        for (String actionType : actionTypes) {
            facts.add(new EncounterCreatureFacts.ActionFacts(actionType));
        }
        return List.copyOf(facts);
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

}
