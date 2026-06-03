package src.domain.creatures;

import java.util.List;
import src.domain.creatures.model.catalog.CreatureCatalogData;
import src.domain.creatures.model.catalog.repository.CreaturesPublishedStateRepository;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.CreatureReadStatus;

final class CreaturesPublishedStateServiceAssembly implements CreaturesPublishedStateRepository {

    private static final CreatureCatalogData.DistinctFilterValues EMPTY_FILTER_VALUES =
            CreatureCatalogData.emptyFilterValues();
    private static final CreatureCatalogData.CatalogPageData EMPTY_CATALOG_PAGE =
            CreatureCatalogData.emptyCatalogPage(50, 0);

    private final CreaturesPublishedModelChannelServiceAssembly<
            src.domain.creatures.published.CreatureFilterOptionsResult> filterOptions =
            new CreaturesPublishedModelChannelServiceAssembly<>(
                    new src.domain.creatures.published.CreatureFilterOptionsResult(
                            CreatureReadStatus.STORAGE_ERROR,
                            CreaturesPublicationProjectionServiceAssembly.toPublishedFilterOptions(
                                    EMPTY_FILTER_VALUES,
                                    List.of())));
    private final CreaturesPublishedModelChannelServiceAssembly<
            src.domain.creatures.published.CreatureCatalogPageResult> catalog =
            new CreaturesPublishedModelChannelServiceAssembly<>(
                    new src.domain.creatures.published.CreatureCatalogPageResult(
                            CreatureQueryStatus.STORAGE_ERROR,
                            CreaturesPublicationProjectionServiceAssembly.toPublishedCatalogPage(EMPTY_CATALOG_PAGE)));
    private final CreaturesPublishedModelChannelServiceAssembly<
            src.domain.creatures.published.CreatureDetailResult> detail =
            new CreaturesPublishedModelChannelServiceAssembly<>(
                    new src.domain.creatures.published.CreatureDetailResult(
                            CreatureLookupStatus.STORAGE_ERROR,
                            null));
    private final CreaturesPublishedModelChannelServiceAssembly<
            src.domain.creatures.published.CreatureEncounterCandidatesResult> encounterCandidates =
            new CreaturesPublishedModelChannelServiceAssembly<>(
                    new src.domain.creatures.published.CreatureEncounterCandidatesResult(
                            CreatureQueryStatus.STORAGE_ERROR,
                            List.of()));

    private final src.domain.creatures.published.CreatureFilterOptionsModel filterOptionsModel =
            new src.domain.creatures.published.CreatureFilterOptionsModel(
                    filterOptions::snapshot,
                    filterOptions::listen);
    private final src.domain.creatures.published.CreatureCatalogModel catalogModel =
            new src.domain.creatures.published.CreatureCatalogModel(
                    catalog::snapshot,
                    catalog::listen);
    private final src.domain.creatures.published.CreatureDetailModel detailModel =
            new src.domain.creatures.published.CreatureDetailModel(
                    detail::snapshot,
                    detail::listen);
    private final src.domain.creatures.published.CreatureEncounterCandidatesModel encounterCandidatesModel =
            new src.domain.creatures.published.CreatureEncounterCandidatesModel(
                    encounterCandidates::snapshot,
                    encounterCandidates::listen);

    src.domain.creatures.published.CreatureFilterOptionsModel filterOptionsModel() {
        return filterOptionsModel;
    }

    src.domain.creatures.published.CreatureCatalogModel catalogModel() {
        return catalogModel;
    }

    src.domain.creatures.published.CreatureDetailModel detailModel() {
        return detailModel;
    }

    src.domain.creatures.published.CreatureEncounterCandidatesModel encounterCandidatesModel() {
        return encounterCandidatesModel;
    }

    @Override
    public void publishFilterOptions(FilterOptionsPublication result) {
        FilterOptionsPublication safeResult = result == null
                ? new FilterOptionsPublication(STORAGE_ERROR, EMPTY_FILTER_VALUES, List.of())
                : result;
        filterOptions.replace(new src.domain.creatures.published.CreatureFilterOptionsResult(
                CreaturesPublicationProjectionServiceAssembly.toReadStatus(safeResult.status()),
                CreaturesPublicationProjectionServiceAssembly.toPublishedFilterOptions(
                        safeResult.values(),
                        safeResult.challengeRatings())));
    }

    @Override
    public void publishCatalogPage(CatalogPagePublication result) {
        CatalogPagePublication safeResult = result == null
                ? new CatalogPagePublication(STORAGE_ERROR, EMPTY_CATALOG_PAGE)
                : result;
        catalog.replace(new src.domain.creatures.published.CreatureCatalogPageResult(
                CreaturesPublicationProjectionServiceAssembly.toQueryStatus(safeResult.status()),
                CreaturesPublicationProjectionServiceAssembly.toPublishedCatalogPage(safeResult.page())));
    }

    @Override
    public void publishCreatureDetail(CreatureDetailPublication result) {
        CreatureDetailPublication safeResult = result == null
                ? new CreatureDetailPublication(STORAGE_ERROR, null)
                : result;
        detail.replace(new src.domain.creatures.published.CreatureDetailResult(
                CreaturesPublicationProjectionServiceAssembly.toLookupStatus(safeResult.status()),
                CreaturesPublicationProjectionServiceAssembly.toPublishedCreatureDetail(safeResult.detail())));
    }

    @Override
    public void publishEncounterCandidates(EncounterCandidatesPublication result) {
        EncounterCandidatesPublication safeResult = result == null
                ? new EncounterCandidatesPublication(STORAGE_ERROR, List.of())
                : result;
        encounterCandidates.replace(new src.domain.creatures.published.CreatureEncounterCandidatesResult(
                CreaturesPublicationProjectionServiceAssembly.toQueryStatus(safeResult.status()),
                safeResult.candidates().stream()
                        .map(CreaturesPublicationProjectionServiceAssembly::toPublishedEncounterCandidate)
                        .toList()));
    }
}
