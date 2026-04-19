package src.data.creatures.mapper;

import org.jspecify.annotations.Nullable;
import src.data.creatures.model.CreatureDetailRecord;
import src.domain.creatures.api.CreatureDetail;

public final class CreatureDetailMapper {

    private CreatureDetailMapper() {
    }

    public static @Nullable CreatureDetail toDomain(@Nullable CreatureDetailRecord record) {
        if (record == null) {
            return null;
        }
        CreatureDetailRecord.Identity identity = record.identity();
        CreatureDetailRecord.HitDice hitDice = record.hitDice();
        CreatureDetailRecord.Armor armor = record.armor();
        CreatureDetailRecord.Movement movement = record.movement();
        CreatureDetailRecord.AbilityScores abilityScores = record.abilityScores();
        CreatureDetailRecord.Proficiency proficiency = record.proficiency();
        CreatureDetailRecord.Traits traits = record.traits();
        return new CreatureDetail(
                identity.id(),
                safeText(identity.name()),
                safeText(identity.size()),
                safeText(identity.creatureType()),
                identity.subtypes(),
                identity.biomes(),
                safeText(identity.alignment()),
                safeText(identity.challengeRating()),
                identity.xp(),
                hitDice.hitPoints(),
                hitDice.expression(),
                hitDice.count(),
                hitDice.sides(),
                hitDice.modifier(),
                armor.armorClass(),
                armor.notes(),
                movement.walkSpeed(),
                movement.flySpeed(),
                movement.swimSpeed(),
                movement.climbSpeed(),
                movement.burrowSpeed(),
                abilityScores.strength(),
                abilityScores.dexterity(),
                abilityScores.constitution(),
                abilityScores.intelligence(),
                abilityScores.wisdom(),
                abilityScores.charisma(),
                proficiency.initiativeBonus(),
                proficiency.proficiencyBonus(),
                traits.savingThrows(),
                traits.skills(),
                traits.damageVulnerabilities(),
                traits.damageResistances(),
                traits.damageImmunities(),
                traits.conditionImmunities(),
                traits.senses(),
                traits.passivePerception(),
                traits.languages(),
                traits.legendaryActionCount(),
                record.actions().stream().map(CreatureActionMapper::toDomain).toList());
    }

    private static String safeText(@Nullable String value) {
        return value == null ? "" : value;
    }
}
