package src.data.creatures.mapper;

import org.jspecify.annotations.Nullable;
import src.data.creatures.model.CreatureActionRecord;
import src.data.creatures.model.CreatureCatalogPageRecord;
import src.data.creatures.model.CreatureCatalogRecord;
import src.data.creatures.model.CreatureDetailRecord;
import src.data.creatures.model.CreatureFilterValuesRecord;
import src.data.creatures.model.EncounterCandidateRecord;
import src.domain.creatures.api.CreatureActionDetail;
import src.domain.creatures.api.CreatureCatalogPage;
import src.domain.creatures.api.CreatureCatalogRow;
import src.domain.creatures.api.CreatureDetail;
import src.domain.creatures.api.EncounterCandidate;
import src.domain.creatures.catalog.CreatureCatalogQueryPort;

public final class CreatureCatalogMapper {

    private CreatureCatalogMapper() {
    }

    public static CreatureCatalogQueryPort.DistinctFilterValues toQueryValues(CreatureFilterValuesRecord record) {
        return new CreatureCatalogQueryPort.DistinctFilterValues(
                record.sizes(),
                record.types(),
                record.subtypes(),
                record.biomes(),
                record.alignments());
    }

    public static CreatureCatalogPage toDomain(CreatureCatalogPageRecord record) {
        return new CreatureCatalogPage(
                record.rows().stream().map(CreatureCatalogMapper::toDomain).toList(),
                record.totalCount(),
                record.pageSize(),
                record.pageOffset());
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
                record.actions().stream().map(CreatureCatalogMapper::toDomain).toList());
    }

    public static CreatureCatalogRow toDomain(CreatureCatalogRecord record) {
        return new CreatureCatalogRow(
                record.id(),
                safeText(record.name()),
                safeText(record.size()),
                safeText(record.creatureType()),
                safeText(record.alignment()),
                safeText(record.challengeRating()),
                record.xp(),
                record.hitPoints(),
                record.armorClass());
    }

    public static EncounterCandidate toDomain(EncounterCandidateRecord record) {
        return new EncounterCandidate(
                record.id(),
                safeText(record.name()),
                safeText(record.creatureType()),
                safeText(record.challengeRating()),
                record.xp(),
                record.hitPoints(),
                record.hitDiceCount(),
                record.hitDiceSides(),
                record.hitDiceModifier(),
                record.armorClass(),
                record.initiativeBonus(),
                record.legendaryActionCount());
    }

    public static CreatureActionDetail toDomain(CreatureActionRecord record) {
        return new CreatureActionDetail(
                safeText(record.actionType()),
                safeText(record.name()),
                safeText(record.description()),
                record.toHitBonus());
    }

    private static String safeText(@Nullable String value) {
        return value == null ? "" : value;
    }
}
