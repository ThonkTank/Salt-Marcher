package features.creatures.adapter.sqlite.model;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record CreatureDetailRecord(
        Identity identity,
        Vitals vitals,
        Traits traits,
        List<CreatureActionRecord> actions
) {
    public CreatureDetailRecord {
        actions = immutableCopy(actions);
    }

    @Override
    public List<CreatureActionRecord> actions() {
        return List.copyOf(actions);
    }

    public record Identity(
            long id,
            String name,
            Classification classification,
            String challengeRating,
            int xp
    ) {
    }

    public record Classification(
            String size,
            String creatureType,
            List<String> subtypes,
            List<String> biomes,
            String alignment
    ) {
        public Classification {
            subtypes = immutableCopy(subtypes);
            biomes = immutableCopy(biomes);
        }

        @Override
        public List<String> subtypes() {
            return List.copyOf(subtypes);
        }

        @Override
        public List<String> biomes() {
            return List.copyOf(biomes);
        }
    }

    public record HitDice(
            int hitPoints,
            @Nullable String expression,
            @Nullable Integer count,
            @Nullable Integer sides,
            @Nullable Integer modifier
    ) {
    }

    public record Armor(int armorClass, @Nullable String notes) {
    }

    public record Movement(
            int walkSpeed,
            int flySpeed,
            int swimSpeed,
            int climbSpeed,
            int burrowSpeed
    ) {
    }

    public record AbilityScores(
            int strength,
            int dexterity,
            int constitution,
            int intelligence,
            int wisdom,
            int charisma
    ) {
    }

    public record Proficiency(int initiativeBonus, int proficiencyBonus) {
    }

    public record Traits(
            TraitProficiencies proficiencies,
            Defenses defenses,
            Awareness awareness,
            int legendaryActionCount
    ) {
    }

    public record TraitProficiencies(
            @Nullable String savingThrows,
            @Nullable String skills
    ) {
    }

    public record Defenses(
            @Nullable String damageVulnerabilities,
            @Nullable String damageResistances,
            @Nullable String damageImmunities,
            @Nullable String conditionImmunities
    ) {
    }

    public record Awareness(
            @Nullable String senses,
            int passivePerception,
            @Nullable String languages
    ) {
    }

    public record Vitals(
            HitDice hitDice,
            Armor armor,
            Movement movement,
            AbilityScores abilityScores,
            Proficiency proficiency
    ) {
    }

    private static <T> List<T> immutableCopy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
