package src.domain.creatures.api;

import org.jspecify.annotations.Nullable;

import java.util.List;

public record CreatureDetail(
        long id,
        String name,
        String size,
        String creatureType,
        List<String> subtypes,
        List<String> biomes,
        String alignment,
        String challengeRating,
        int xp,
        int hitPoints,
        @Nullable String hitDiceExpression,
        @Nullable Integer hitDiceCount,
        @Nullable Integer hitDiceSides,
        @Nullable Integer hitDiceModifier,
        int armorClass,
        @Nullable String armorClassNotes,
        int walkSpeed,
        int flySpeed,
        int swimSpeed,
        int climbSpeed,
        int burrowSpeed,
        int strength,
        int dexterity,
        int constitution,
        int intelligence,
        int wisdom,
        int charisma,
        int initiativeBonus,
        int proficiencyBonus,
        @Nullable String savingThrows,
        @Nullable String skills,
        @Nullable String damageVulnerabilities,
        @Nullable String damageResistances,
        @Nullable String damageImmunities,
        @Nullable String conditionImmunities,
        @Nullable String senses,
        int passivePerception,
        @Nullable String languages,
        int legendaryActionCount,
        List<CreatureActionDetail> actions
) {
    public CreatureDetail {
        subtypes = subtypes == null ? List.of() : List.copyOf(subtypes);
        biomes = biomes == null ? List.of() : List.copyOf(biomes);
        actions = actions == null ? List.of() : List.copyOf(actions);
    }
}
