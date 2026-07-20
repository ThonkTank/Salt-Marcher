package features.creatures.adapter.sqlite.mapper;

import org.jspecify.annotations.Nullable;
import features.creatures.adapter.sqlite.model.CreatureDetailRecord;

final class CreatureDetailTraitFields {

    final @Nullable String savingThrows;
    final @Nullable String skills;
    final @Nullable String damageVulnerabilities;
    final @Nullable String damageResistances;
    final @Nullable String damageImmunities;
    final @Nullable String conditionImmunities;
    final @Nullable String senses;
    final int passivePerception;
    final @Nullable String languages;
    final int legendaryActionCount;

    CreatureDetailTraitFields(CreatureDetailRecord.Traits traits) {
        CreatureDetailRecord.TraitProficiencies proficiencies = traits.proficiencies();
        CreatureDetailRecord.Defenses defenses = traits.defenses();
        CreatureDetailRecord.Awareness awareness = traits.awareness();
        savingThrows = proficiencies.savingThrows();
        skills = proficiencies.skills();
        damageVulnerabilities = defenses.damageVulnerabilities();
        damageResistances = defenses.damageResistances();
        damageImmunities = defenses.damageImmunities();
        conditionImmunities = defenses.conditionImmunities();
        senses = awareness.senses();
        passivePerception = awareness.passivePerception();
        languages = awareness.languages();
        legendaryActionCount = traits.legendaryActionCount();
    }
}
