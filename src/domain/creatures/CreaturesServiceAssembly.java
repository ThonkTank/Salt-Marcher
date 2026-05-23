package src.domain.creatures;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;
import shell.api.ServiceRegistry;
import src.domain.creatures.model.catalog.model.CreatureCatalogData;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.creatures.model.catalog.repository.CreaturesPublishedStateRepository;
import src.domain.creatures.model.catalog.usecase.LoadCreatureDetailUseCase;
import src.domain.creatures.model.catalog.usecase.LoadCreatureEncounterCandidatesUseCase;
import src.domain.creatures.model.catalog.usecase.LoadCreatureFilterOptionsUseCase;
import src.domain.creatures.model.catalog.usecase.SearchCreatureCatalogUseCase;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.CreatureReadStatus;

final class CreaturesServiceAssembly {

    private static final String REGISTRY_PARAMETER = "registry";

    private final CreaturesPublishedState publishedState = new CreaturesPublishedState();

    CreaturesApplicationService createApplicationService(ServiceRegistry registry) {
        ServiceRegistry services = Objects.requireNonNull(registry, REGISTRY_PARAMETER);
        CreatureCatalogPort lookup = services.require(CreatureCatalogPort.class);
        return new CreaturesApplicationService(
                new LoadCreatureFilterOptionsUseCase(lookup, publishedState),
                new SearchCreatureCatalogUseCase(lookup, publishedState),
                new LoadCreatureDetailUseCase(lookup, publishedState),
                new LoadCreatureEncounterCandidatesUseCase(lookup, publishedState));
    }

    src.domain.creatures.published.CreatureFilterOptionsModel createFilterOptionsModel(
            ServiceRegistry registry
    ) {
        Objects.requireNonNull(registry, REGISTRY_PARAMETER);
        return publishedState.filterOptionsModel();
    }

    src.domain.creatures.published.CreatureCatalogModel createCatalogModel(ServiceRegistry registry) {
        Objects.requireNonNull(registry, REGISTRY_PARAMETER);
        return publishedState.catalogModel();
    }

    src.domain.creatures.published.CreatureDetailModel createDetailModel(ServiceRegistry registry) {
        Objects.requireNonNull(registry, REGISTRY_PARAMETER);
        return publishedState.detailModel();
    }

    src.domain.creatures.published.CreatureEncounterCandidatesModel createEncounterCandidatesModel(
            ServiceRegistry registry
    ) {
        Objects.requireNonNull(registry, REGISTRY_PARAMETER);
        return publishedState.encounterCandidatesModel();
    }

    private static final class CreaturesPublishedState implements CreaturesPublishedStateRepository {

        private static final CreatureCatalogData.DistinctFilterValues EMPTY_FILTER_VALUES =
                CreatureCatalogData.emptyFilterValues();
        private static final CreatureCatalogData.CatalogPageData EMPTY_CATALOG_PAGE =
                CreatureCatalogData.emptyCatalogPage(50, 0);

        private final PublishedModelChannel<src.domain.creatures.published.CreatureFilterOptionsResult> filterOptions =
                new PublishedModelChannel<>(new src.domain.creatures.published.CreatureFilterOptionsResult(
                        CreatureReadStatus.STORAGE_ERROR,
                        CreaturesPublicationProjection.toPublishedFilterOptions(EMPTY_FILTER_VALUES, List.of())));
        private final PublishedModelChannel<src.domain.creatures.published.CreatureCatalogPageResult> catalog =
                new PublishedModelChannel<>(new src.domain.creatures.published.CreatureCatalogPageResult(
                        CreatureQueryStatus.STORAGE_ERROR,
                        CreaturesPublicationProjection.toPublishedCatalogPage(EMPTY_CATALOG_PAGE)));
        private final PublishedModelChannel<src.domain.creatures.published.CreatureDetailResult> detail =
                new PublishedModelChannel<>(new src.domain.creatures.published.CreatureDetailResult(
                        CreatureLookupStatus.STORAGE_ERROR,
                        null));
        private final PublishedModelChannel<src.domain.creatures.published.CreatureEncounterCandidatesResult>
                encounterCandidates = new PublishedModelChannel<>(
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

        private src.domain.creatures.published.CreatureFilterOptionsModel filterOptionsModel() {
            return filterOptionsModel;
        }

        private src.domain.creatures.published.CreatureCatalogModel catalogModel() {
            return catalogModel;
        }

        private src.domain.creatures.published.CreatureDetailModel detailModel() {
            return detailModel;
        }

        private src.domain.creatures.published.CreatureEncounterCandidatesModel encounterCandidatesModel() {
            return encounterCandidatesModel;
        }

        @Override
        public void publishFilterOptions(FilterOptionsPublication result) {
            FilterOptionsPublication safeResult = result == null
                    ? new FilterOptionsPublication(STORAGE_ERROR, EMPTY_FILTER_VALUES, List.of())
                    : result;
            filterOptions.replace(new src.domain.creatures.published.CreatureFilterOptionsResult(
                    CreaturesPublicationProjection.toReadStatus(safeResult.status()),
                    CreaturesPublicationProjection.toPublishedFilterOptions(
                            safeResult.values(),
                            safeResult.challengeRatings())));
        }

        @Override
        public void publishCatalogPage(CatalogPagePublication result) {
            CatalogPagePublication safeResult = result == null
                    ? new CatalogPagePublication(STORAGE_ERROR, EMPTY_CATALOG_PAGE)
                    : result;
            catalog.replace(new src.domain.creatures.published.CreatureCatalogPageResult(
                    CreaturesPublicationProjection.toQueryStatus(safeResult.status()),
                    CreaturesPublicationProjection.toPublishedCatalogPage(safeResult.page())));
        }

        @Override
        public void publishCreatureDetail(CreatureDetailPublication result) {
            CreatureDetailPublication safeResult = result == null
                    ? new CreatureDetailPublication(STORAGE_ERROR, null)
                    : result;
            detail.replace(new src.domain.creatures.published.CreatureDetailResult(
                    CreaturesPublicationProjection.toLookupStatus(safeResult.status()),
                    CreaturesPublicationProjection.toPublishedCreatureDetail(safeResult.detail())));
        }

        @Override
        public void publishEncounterCandidates(EncounterCandidatesPublication result) {
            EncounterCandidatesPublication safeResult = result == null
                    ? new EncounterCandidatesPublication(STORAGE_ERROR, List.of())
                    : result;
            encounterCandidates.replace(new src.domain.creatures.published.CreatureEncounterCandidatesResult(
                    CreaturesPublicationProjection.toQueryStatus(safeResult.status()),
                    safeResult.candidates().stream()
                            .map(CreaturesPublicationProjection::toPublishedEncounterCandidate)
                            .toList()));
        }
    }

    private static final class CreaturesPublicationProjection {

        private CreaturesPublicationProjection() {
        }

        private static CreatureReadStatus toReadStatus(String status) {
            return CreaturesPublishedStateRepository.SUCCESS.equals(status)
                    ? CreatureReadStatus.SUCCESS
                    : CreatureReadStatus.STORAGE_ERROR;
        }

        private static CreatureQueryStatus toQueryStatus(String status) {
            return switch (status) {
                case CreaturesPublishedStateRepository.SUCCESS ->
                        CreatureQueryStatus.SUCCESS;
                case CreaturesPublishedStateRepository.INVALID_QUERY ->
                        CreatureQueryStatus.INVALID_QUERY;
                default -> CreatureQueryStatus.STORAGE_ERROR;
            };
        }

        private static CreatureLookupStatus toLookupStatus(String status) {
            return switch (status) {
                case CreaturesPublishedStateRepository.SUCCESS ->
                        CreatureLookupStatus.SUCCESS;
                case CreaturesPublishedStateRepository.NOT_FOUND ->
                        CreatureLookupStatus.NOT_FOUND;
                default -> CreatureLookupStatus.STORAGE_ERROR;
            };
        }

        private static src.domain.creatures.published.CreatureFilterOptions toPublishedFilterOptions(
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

        private static src.domain.creatures.published.CreatureCatalogPage toPublishedCatalogPage(
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

        private static src.domain.creatures.published.CreatureDetail toPublishedCreatureDetail(
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

        private static src.domain.creatures.published.CreatureEncounterCandidate toPublishedEncounterCandidate(
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

    private static final class PublishedModelChannel<T> {

        private static final String LISTENER_PARAMETER = "listener";

        private final Set<Consumer<T>> subscribers = new LinkedHashSet<>();
        private T value;

        private PublishedModelChannel(T initialValue) {
            value = Objects.requireNonNull(initialValue, "initialValue");
        }

        private T snapshot() {
            return value;
        }

        private void replace(T nextValue) {
            value = Objects.requireNonNull(nextValue, "nextValue");
            for (Consumer<T> subscriber : Set.copyOf(subscribers)) {
                subscriber.accept(value);
            }
        }

        private Runnable listen(Consumer<T> listener) {
            Consumer<T> subscriber = Objects.requireNonNull(listener, LISTENER_PARAMETER);
            subscribers.add(subscriber);
            return () -> subscribers.remove(subscriber);
        }
    }
}
