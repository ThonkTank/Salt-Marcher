package src.data.creatures.mapper;

import org.jspecify.annotations.Nullable;
import src.data.creatures.model.CreatureDetailRecord;

final class CreatureDetailVitalsFields {

    final int hitPoints;
    final @Nullable String hitDiceExpression;
    final @Nullable Integer hitDiceCount;
    final @Nullable Integer hitDiceSides;
    final @Nullable Integer hitDiceModifier;
    final int armorClass;
    final @Nullable String armorClassNotes;
    final int walkSpeed;
    final int flySpeed;
    final int swimSpeed;
    final int climbSpeed;
    final int burrowSpeed;
    final int strength;
    final int dexterity;
    final int constitution;
    final int intelligence;
    final int wisdom;
    final int charisma;
    final int initiativeBonus;
    final int proficiencyBonus;

    CreatureDetailVitalsFields(CreatureDetailRecord.Vitals vitals) {
        CreatureDetailRecord.HitDice hitDice = vitals.hitDice();
        CreatureDetailRecord.Armor armor = vitals.armor();
        CreatureDetailRecord.Movement movement = vitals.movement();
        CreatureDetailRecord.AbilityScores abilityScores = vitals.abilityScores();
        CreatureDetailRecord.Proficiency proficiency = vitals.proficiency();
        hitPoints = hitDice.hitPoints();
        hitDiceExpression = hitDice.expression();
        hitDiceCount = hitDice.count();
        hitDiceSides = hitDice.sides();
        hitDiceModifier = hitDice.modifier();
        armorClass = armor.armorClass();
        armorClassNotes = armor.notes();
        walkSpeed = movement.walkSpeed();
        flySpeed = movement.flySpeed();
        swimSpeed = movement.swimSpeed();
        climbSpeed = movement.climbSpeed();
        burrowSpeed = movement.burrowSpeed();
        strength = abilityScores.strength();
        dexterity = abilityScores.dexterity();
        constitution = abilityScores.constitution();
        intelligence = abilityScores.intelligence();
        wisdom = abilityScores.wisdom();
        charisma = abilityScores.charisma();
        initiativeBonus = proficiency.initiativeBonus();
        proficiencyBonus = proficiency.proficiencyBonus();
    }
}
