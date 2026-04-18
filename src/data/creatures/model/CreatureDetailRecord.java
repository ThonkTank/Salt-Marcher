package src.data.creatures.model;

import java.util.List;
import org.jspecify.annotations.Nullable;

public final class CreatureDetailRecord {

    private final Identity identity;
    private final HitDice hitDice;
    private final Armor armor;
    private final Movement movement;
    private final AbilityScores abilityScores;
    private final Proficiency proficiency;
    private final Traits traits;
    private final List<CreatureActionRecord> actions;

    public CreatureDetailRecord(
            Identity identity,
            HitDice hitDice,
            Armor armor,
            Movement movement,
            AbilityScores abilityScores,
            Proficiency proficiency,
            Traits traits,
            List<CreatureActionRecord> actions
    ) {
        this.identity = identity;
        this.hitDice = hitDice;
        this.armor = armor;
        this.movement = movement;
        this.abilityScores = abilityScores;
        this.proficiency = proficiency;
        this.traits = traits;
        this.actions = immutableCopy(actions);
    }

    public long id() {
        return identity.id();
    }

    public String name() {
        return identity.name();
    }

    public String size() {
        return identity.size();
    }

    public String creatureType() {
        return identity.creatureType();
    }

    public List<String> subtypes() {
        return identity.subtypes();
    }

    public List<String> biomes() {
        return identity.biomes();
    }

    public String alignment() {
        return identity.alignment();
    }

    public String challengeRating() {
        return identity.challengeRating();
    }

    public int xp() {
        return identity.xp();
    }

    public int hitPoints() {
        return hitDice.hitPoints();
    }

    public @Nullable String hitDiceExpression() {
        return hitDice.expression();
    }

    public @Nullable Integer hitDiceCount() {
        return hitDice.count();
    }

    public @Nullable Integer hitDiceSides() {
        return hitDice.sides();
    }

    public @Nullable Integer hitDiceModifier() {
        return hitDice.modifier();
    }

    public int armorClass() {
        return armor.armorClass();
    }

    public @Nullable String armorClassNotes() {
        return armor.notes();
    }

    public int walkSpeed() {
        return movement.walkSpeed();
    }

    public int flySpeed() {
        return movement.flySpeed();
    }

    public int swimSpeed() {
        return movement.swimSpeed();
    }

    public int climbSpeed() {
        return movement.climbSpeed();
    }

    public int burrowSpeed() {
        return movement.burrowSpeed();
    }

    public int strength() {
        return abilityScores.strength();
    }

    public int dexterity() {
        return abilityScores.dexterity();
    }

    public int constitution() {
        return abilityScores.constitution();
    }

    public int intelligence() {
        return abilityScores.intelligence();
    }

    public int wisdom() {
        return abilityScores.wisdom();
    }

    public int charisma() {
        return abilityScores.charisma();
    }

    public int initiativeBonus() {
        return proficiency.initiativeBonus();
    }

    public int proficiencyBonus() {
        return proficiency.proficiencyBonus();
    }

    public @Nullable String savingThrows() {
        return traits.savingThrows();
    }

    public @Nullable String skills() {
        return traits.skills();
    }

    public @Nullable String damageVulnerabilities() {
        return traits.damageVulnerabilities();
    }

    public @Nullable String damageResistances() {
        return traits.damageResistances();
    }

    public @Nullable String damageImmunities() {
        return traits.damageImmunities();
    }

    public @Nullable String conditionImmunities() {
        return traits.conditionImmunities();
    }

    public @Nullable String senses() {
        return traits.senses();
    }

    public int passivePerception() {
        return traits.passivePerception();
    }

    public @Nullable String languages() {
        return traits.languages();
    }

    public int legendaryActionCount() {
        return traits.legendaryActionCount();
    }

    public List<CreatureActionRecord> actions() {
        return actions;
    }

    public record Identity(
            long id,
            String name,
            String size,
            String creatureType,
            List<String> subtypes,
            List<String> biomes,
            String alignment,
            String challengeRating,
            int xp
    ) {
        public Identity {
            subtypes = immutableCopy(subtypes);
            biomes = immutableCopy(biomes);
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
            @Nullable String savingThrows,
            @Nullable String skills,
            @Nullable String damageVulnerabilities,
            @Nullable String damageResistances,
            @Nullable String damageImmunities,
            @Nullable String conditionImmunities,
            @Nullable String senses,
            int passivePerception,
            @Nullable String languages,
            int legendaryActionCount
    ) {
    }

    private static <T> List<T> immutableCopy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
