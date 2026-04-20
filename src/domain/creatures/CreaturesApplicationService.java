package src.domain.creatures;

import java.util.List;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureCatalogPage;
import src.domain.creatures.published.CreatureCatalogQuery;
import src.domain.creatures.published.CreatureCatalogRow;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureActionDetail;
import src.domain.creatures.published.CreatureFilterOptions;
import src.domain.creatures.published.CreatureFilterOptionsResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.CreatureReadStatus;
import src.domain.creatures.published.EncounterCandidate;
import src.domain.creatures.published.EncounterCandidatesResult;
import src.domain.creatures.published.EncounterCandidateQuery;
import src.domain.creatures.application.LoadCreatureDetailUseCase;
import src.domain.creatures.application.LoadCreatureFilterOptionsUseCase;
import src.domain.creatures.application.LoadEncounterCandidatesUseCase;
import src.domain.creatures.application.SearchCreatureCatalogUseCase;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;

import java.util.Objects;

/**
 * Public read-only backend facade for creature catalog access.
 */
public final class CreaturesApplicationService {

    @FunctionalInterface
    public interface Factory {

        CreaturesApplicationService create();
    }

    private final LoadCreatureFilterOptionsUseCase loadCreatureFilterOptionsUseCase;
    private final SearchCreatureCatalogUseCase searchCreatureCatalogUseCase;
    private final LoadCreatureDetailUseCase loadCreatureDetailUseCase;
    private final LoadEncounterCandidatesUseCase loadEncounterCandidatesUseCase;

    public CreaturesApplicationService(CreatureCatalogLookup queryPort) {
        CreatureCatalogLookup lookup = Objects.requireNonNull(queryPort, "queryPort");
        this.loadCreatureFilterOptionsUseCase = new LoadCreatureFilterOptionsUseCase(lookup);
        this.searchCreatureCatalogUseCase = new SearchCreatureCatalogUseCase(lookup);
        this.loadCreatureDetailUseCase = new LoadCreatureDetailUseCase(lookup);
        this.loadEncounterCandidatesUseCase = new LoadEncounterCandidatesUseCase(lookup);
    }

    public CreatureFilterOptionsResult loadFilterOptions() {
        try {
            return new CreatureFilterOptionsResult(
                    CreatureReadStatus.SUCCESS,
                    toPublishedFilterOptions(loadCreatureFilterOptionsUseCase.execute()));
        } catch (RuntimeException exception) {
            return new CreatureFilterOptionsResult(
                    CreatureReadStatus.STORAGE_ERROR,
                    CreatureFilterOptions.empty());
        }
    }

    public CreatureCatalogPageResult searchCatalog(CreatureCatalogQuery query) {
        try {
            SearchCreatureCatalogUseCase.SearchResult result = searchCreatureCatalogUseCase.execute(query);
            if (result.invalidQuery()) {
                return new CreatureCatalogPageResult(
                        CreatureQueryStatus.INVALID_QUERY,
                        CreatureCatalogPage.empty(result.pageSize(), result.pageOffset()));
            }
            return new CreatureCatalogPageResult(
                    CreatureQueryStatus.SUCCESS,
                    toPublishedCatalogPage(result.page()));
        } catch (RuntimeException exception) {
            CreatureCatalogQuery effectiveQuery = query == null ? CreatureCatalogQuery.defaults() : query;
            return new CreatureCatalogPageResult(
                    CreatureQueryStatus.STORAGE_ERROR,
                    CreatureCatalogPage.empty(effectiveQuery.pageSize(), effectiveQuery.pageOffset()));
        }
    }

    public CreatureDetailResult loadCreatureDetail(long creatureId) {
        try {
            CreatureCatalogLookup.CreatureProfile detail = loadCreatureDetailUseCase.execute(creatureId);
            if (detail == null) {
                return new CreatureDetailResult(CreatureLookupStatus.NOT_FOUND, null);
            }
            return new CreatureDetailResult(CreatureLookupStatus.SUCCESS, toPublishedCreatureDetail(detail));
        } catch (RuntimeException exception) {
            return new CreatureDetailResult(CreatureLookupStatus.STORAGE_ERROR, null);
        }
    }

    public EncounterCandidatesResult loadEncounterCandidates(EncounterCandidateQuery query) {
        try {
            LoadEncounterCandidatesUseCase.LoadResult result = loadEncounterCandidatesUseCase.execute(query);
            if (result.invalidQuery()) {
                return new EncounterCandidatesResult(CreatureQueryStatus.INVALID_QUERY, List.of());
            }
            return new EncounterCandidatesResult(
                    CreatureQueryStatus.SUCCESS,
                    result.candidates().stream().map(CreaturesApplicationService::toPublishedEncounterCandidate).toList());
        } catch (RuntimeException exception) {
            return new EncounterCandidatesResult(CreatureQueryStatus.STORAGE_ERROR, List.of());
        }
    }

    private static CreatureFilterOptions toPublishedFilterOptions(LoadCreatureFilterOptionsUseCase.FilterOptions options) {
        return new CreatureFilterOptions(
                options.sizes(),
                options.types(),
                options.subtypes(),
                options.biomes(),
                options.alignments(),
                options.challengeRatings());
    }

    private static CreatureCatalogPage toPublishedCatalogPage(CreatureCatalogLookup.CatalogPage page) {
        return new CreatureCatalogPage(
                page.rows().stream().map(CreaturesApplicationService::toPublishedCatalogRow).toList(),
                page.totalCount(),
                page.pageSize(),
                page.pageOffset());
    }

    private static CreatureCatalogRow toPublishedCatalogRow(CreatureCatalogLookup.CatalogRow row) {
        return new CreatureCatalogRow(
                row.id(),
                row.name(),
                row.size(),
                row.creatureType(),
                row.alignment(),
                row.challengeRating(),
                row.xp(),
                row.hitPoints(),
                row.armorClass());
    }

    private static CreatureDetail toPublishedCreatureDetail(CreatureCatalogLookup.CreatureProfile detail) {
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
                detail.actions().stream().map(CreaturesApplicationService::toPublishedActionDetail).toList());
    }

    private static CreatureActionDetail toPublishedActionDetail(CreatureCatalogLookup.ActionProfile action) {
        return new CreatureActionDetail(
                action.actionType(),
                action.name(),
                action.description(),
                action.toHitBonus());
    }

    private static EncounterCandidate toPublishedEncounterCandidate(CreatureCatalogLookup.EncounterCandidateProfile candidate) {
        return new EncounterCandidate(
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
                candidate.legendaryActionCount());
    }
}
