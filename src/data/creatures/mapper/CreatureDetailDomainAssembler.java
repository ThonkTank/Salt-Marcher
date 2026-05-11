package src.data.creatures.mapper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.data.creatures.model.CreatureActionRecord;
import src.data.creatures.model.CreatureDetailRecord;
import src.domain.creatures.model.catalog.port.CreatureCatalogLookup;

final class CreatureDetailDomainAssembler {

    private final CreatureDetailIdentityFields identity;
    private final CreatureDetailVitalsFields vitals;
    private final CreatureDetailTraitFields traits;
    private final List<CreatureCatalogLookup.CreatureActionData> actions;

    CreatureDetailDomainAssembler(CreatureDetailRecord record) {
        identity = new CreatureDetailIdentityFields(record.identity());
        vitals = new CreatureDetailVitalsFields(record.vitals());
        traits = new CreatureDetailTraitFields(record.traits());
        actions = mapActions(record.actions());
    }

    CreatureCatalogLookup.CreatureProfile toDomain() {
        return new CreatureCatalogLookup.CreatureProfile(
                new CreatureCatalogLookup.CreatureIdentity(
                        identity.id,
                        safeText(identity.name),
                        safeText(identity.size),
                        safeText(identity.creatureType),
                        identity.subtypes,
                        identity.biomes,
                        safeText(identity.alignment),
                        safeText(identity.challengeRating),
                        identity.xp),
                new CreatureCatalogLookup.CreatureVitals(
                        vitals.hitPoints,
                        vitals.hitDiceExpression,
                        vitals.hitDiceCount,
                        vitals.hitDiceSides,
                        vitals.hitDiceModifier,
                        vitals.armorClass,
                        vitals.armorClassNotes,
                        vitals.walkSpeed,
                        vitals.flySpeed,
                        vitals.swimSpeed,
                        vitals.climbSpeed,
                        vitals.burrowSpeed),
                new CreatureCatalogLookup.CreatureAbilities(
                        vitals.strength,
                        vitals.dexterity,
                        vitals.constitution,
                        vitals.intelligence,
                        vitals.wisdom,
                        vitals.charisma,
                        vitals.initiativeBonus,
                        vitals.proficiencyBonus),
                new CreatureCatalogLookup.CreatureTraits(
                        traits.savingThrows,
                        traits.skills,
                        traits.damageVulnerabilities,
                        traits.damageResistances,
                        traits.damageImmunities,
                        traits.conditionImmunities,
                        traits.senses,
                        traits.passivePerception,
                        traits.languages,
                        traits.legendaryActionCount),
                actions);
    }

    private static List<CreatureCatalogLookup.CreatureActionData> mapActions(List<CreatureActionRecord> records) {
        return records.stream().map(CreatureActionMapper::toDomain).toList();
    }

    private static String safeText(@Nullable String value) {
        return value == null ? "" : value;
    }
}
