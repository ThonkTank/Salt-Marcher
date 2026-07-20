package features.creatures.application;

import java.util.List;
import features.creatures.domain.catalog.CreatureCatalogData;
import features.creatures.api.CreatureActionDetail;
import features.creatures.api.CreatureCatalogPage;
import features.creatures.api.CreatureCatalogRow;
import features.creatures.api.CreatureDetail;
import features.creatures.api.CreatureEncounterCandidate;
import features.creatures.api.CreatureFilterOptions;

public final class CreatureCatalogProjection {

    private CreatureCatalogProjection() {
    }

    static CreatureFilterOptions filterOptions(
            CreatureCatalogData.DistinctFilterValues values,
            List<String> challengeRatings
    ) {
        CreatureCatalogData.DistinctFilterValues safeValues = values == null
                ? CreatureCatalogData.emptyFilterValues()
                : values;
        return new CreatureFilterOptions(
                safeValues.sizes(),
                safeValues.types(),
                safeValues.subtypes(),
                safeValues.biomes(),
                safeValues.alignments(),
                challengeRatings == null ? List.of() : List.copyOf(challengeRatings));
    }

    static CreatureCatalogPage catalogPage(CreatureCatalogData.CatalogPageData page) {
        CreatureCatalogData.CatalogPageData safePage = page == null
                ? CreatureCatalogData.emptyCatalogPage(50, 0)
                : page;
        return new CreatureCatalogPage(
                safePage.rows().stream()
                        .map(row -> new CreatureCatalogRow(
                                row.id(),
                                row.name(),
                                row.size(),
                                row.creatureType(),
                                row.alignment(),
                                row.challengeRating(),
                                row.xp(),
                                row.hitPoints(),
                                row.armorClass()))
                        .toList(),
                safePage.totalCount(),
                safePage.pageSize(),
                safePage.pageOffset());
    }

    public static CreatureDetail creatureDetail(CreatureCatalogData.CreatureProfile detail) {
        if (detail == null) {
            return null;
        }
        return new CreatureDetail(
                detail.id(),
                detail.name(),
                detail.size(),
                detail.creatureType(),
                detail.subtypes(),
                detail.biomes(),
                detail.alignment(),
                detail.challengeRating(),
                detail.xp(),
                detail.hitPoints(),
                detail.hitDiceExpression(),
                detail.hitDiceCount(),
                detail.hitDiceSides(),
                detail.hitDiceModifier(),
                detail.armorClass(),
                detail.armorClassNotes(),
                detail.walkSpeed(),
                detail.flySpeed(),
                detail.swimSpeed(),
                detail.climbSpeed(),
                detail.burrowSpeed(),
                detail.strength(),
                detail.dexterity(),
                detail.constitution(),
                detail.intelligence(),
                detail.wisdom(),
                detail.charisma(),
                detail.initiativeBonus(),
                detail.proficiencyBonus(),
                detail.savingThrows(),
                detail.skills(),
                detail.damageVulnerabilities(),
                detail.damageResistances(),
                detail.damageImmunities(),
                detail.conditionImmunities(),
                detail.senses(),
                detail.passivePerception(),
                detail.languages(),
                detail.legendaryActionCount(),
                detail.actions().stream()
                        .map(action -> new CreatureActionDetail(
                                action.actionType(),
                                action.name(),
                                action.description(),
                                action.toHitBonus()))
                        .toList());
    }

    public static CreatureEncounterCandidate encounterCandidate(CreatureCatalogData.EncounterCandidateProfile candidate) {
        return new CreatureEncounterCandidate(
                candidate.id(),
                candidate.name(),
                candidate.creatureType(),
                candidate.challengeRating(),
                candidate.xp(),
                candidate.hitPoints(),
                candidate.hitDiceCount(),
                candidate.hitDiceSides(),
                candidate.hitDiceModifier(),
                candidate.armorClass(),
                candidate.initiativeBonus(),
                candidate.legendaryActionCount(),
                1);
    }
}
