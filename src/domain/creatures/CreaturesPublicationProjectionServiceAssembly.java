package src.domain.creatures;

import java.util.List;
import src.domain.creatures.model.catalog.model.CreatureCatalogData;
import src.domain.creatures.model.catalog.repository.CreaturesPublishedStateRepository;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.CreatureReadStatus;

final class CreaturesPublicationProjectionServiceAssembly {

    private CreaturesPublicationProjectionServiceAssembly() {
    }

    static CreatureReadStatus toReadStatus(String status) {
        return CreaturesPublishedStateRepository.SUCCESS.equals(status)
                ? CreatureReadStatus.SUCCESS
                : CreatureReadStatus.STORAGE_ERROR;
    }

    static CreatureQueryStatus toQueryStatus(String status) {
        return switch (status) {
            case CreaturesPublishedStateRepository.SUCCESS -> CreatureQueryStatus.SUCCESS;
            case CreaturesPublishedStateRepository.INVALID_QUERY -> CreatureQueryStatus.INVALID_QUERY;
            default -> CreatureQueryStatus.STORAGE_ERROR;
        };
    }

    static CreatureLookupStatus toLookupStatus(String status) {
        return switch (status) {
            case CreaturesPublishedStateRepository.SUCCESS -> CreatureLookupStatus.SUCCESS;
            case CreaturesPublishedStateRepository.NOT_FOUND -> CreatureLookupStatus.NOT_FOUND;
            default -> CreatureLookupStatus.STORAGE_ERROR;
        };
    }

    static src.domain.creatures.published.CreatureFilterOptions toPublishedFilterOptions(
            CreatureCatalogData.DistinctFilterValues values,
            List<String> challengeRatings
    ) {
        return new src.domain.creatures.published.CreatureFilterOptions(
                values.sizes(),
                values.types(),
                values.subtypes(),
                values.biomes(),
                values.alignments(),
                challengeRatings);
    }

    static src.domain.creatures.published.CreatureCatalogPage toPublishedCatalogPage(
            CreatureCatalogData.CatalogPageData page
    ) {
        return new src.domain.creatures.published.CreatureCatalogPage(
                page.rows().stream()
                        .map(row -> new src.domain.creatures.published.CreatureCatalogRow(
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
                page.totalCount(),
                page.pageSize(),
                page.pageOffset());
    }

    static src.domain.creatures.published.CreatureDetail toPublishedCreatureDetail(
            CreatureCatalogData.CreatureProfile detail
    ) {
        if (detail == null) {
            return null;
        }
        return new src.domain.creatures.published.CreatureDetail(
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
                        .map(action -> new src.domain.creatures.published.CreatureActionDetail(
                                action.actionType(),
                                action.name(),
                                action.description(),
                                action.toHitBonus()))
                        .toList());
    }

    static src.domain.creatures.published.CreatureEncounterCandidate toPublishedEncounterCandidate(
            CreatureCatalogData.EncounterCandidateProfile candidate
    ) {
        return new src.domain.creatures.published.CreatureEncounterCandidate(
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
