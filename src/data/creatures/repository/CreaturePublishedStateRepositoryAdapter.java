package src.data.creatures.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;
import src.domain.creatures.published.CreatureActionDetail;
import src.domain.creatures.published.CreatureCatalogModel;
import src.domain.creatures.published.CreatureCatalogPage;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureFilterOptions;
import src.domain.creatures.published.CreatureFilterOptionsModel;
import src.domain.creatures.published.CreatureFilterOptionsResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.CreatureReadStatus;
import src.domain.creatures.runtime.port.CreaturesPublishedStateRepository;

public final class CreaturePublishedStateRepositoryAdapter implements CreaturesPublishedStateRepository {

    private static final String LISTENER_PARAMETER = "listener";

    private final List<Consumer<CreatureFilterOptionsResult>> filterOptionsListeners = new ArrayList<>();
    private final List<Consumer<CreatureCatalogPageResult>> catalogListeners = new ArrayList<>();
    private final List<Consumer<CreatureDetailResult>> detailListeners = new ArrayList<>();
    private static final CreatureCatalogLookup.DistinctFilterValues EMPTY_FILTER_VALUES =
            new CreatureCatalogLookup.DistinctFilterValues(List.of(), List.of(), List.of(), List.of(), List.of());
    private static final CreatureCatalogLookup.CatalogPage EMPTY_CATALOG_PAGE =
            new CreatureCatalogLookup.CatalogPage(List.of(), 0, 50, 0);

    public final CreatureFilterOptionsModel filterOptionsModel = new CreatureFilterOptionsModel(
            this::currentFilterOptions,
            this::subscribeFilterOptionsListener);
    public final CreatureCatalogModel catalogModel = new CreatureCatalogModel(
            this::currentCatalogPage,
            this::subscribeCatalogListener);
    public final CreatureDetailModel detailModel = new CreatureDetailModel(
            this::currentCreatureDetail,
            this::subscribeDetailListener);

    private CreatureFilterOptionsResult currentFilterOptions =
            new CreatureFilterOptionsResult(CreatureReadStatus.STORAGE_ERROR, CreatureFilterOptions.empty());
    private CreatureCatalogPageResult currentCatalogPage =
            new CreatureCatalogPageResult(CreatureQueryStatus.STORAGE_ERROR, CreatureCatalogPage.empty(50, 0));
    private CreatureDetailResult currentCreatureDetail =
            new CreatureDetailResult(CreatureLookupStatus.STORAGE_ERROR, null);

    @Override
    public void publishFilterOptions(FilterOptionsPublication publication) {
        FilterOptionsPublication safePublication = publication == null
                ? new FilterOptionsPublication(FilterOptionsStatus.STORAGE_ERROR, EMPTY_FILTER_VALUES, List.of())
                : publication;
        currentFilterOptions = new CreatureFilterOptionsResult(
                toReadStatus(safePublication.status()),
                new CreatureFilterOptions(
                        safePublication.values().sizes(),
                        safePublication.values().types(),
                        safePublication.values().subtypes(),
                        safePublication.values().biomes(),
                        safePublication.values().alignments(),
                        safePublication.challengeRatings()));
        notifyListeners(filterOptionsListeners, currentFilterOptions);
    }

    @Override
    public void publishCatalogPage(CatalogPagePublication publication) {
        CatalogPagePublication safePublication = publication == null
                ? new CatalogPagePublication(CatalogPageStatus.STORAGE_ERROR, EMPTY_CATALOG_PAGE)
                : publication;
        currentCatalogPage = new CreatureCatalogPageResult(
                toQueryStatus(safePublication.status()),
                toPublishedCatalogPage(safePublication.page()));
        notifyListeners(catalogListeners, currentCatalogPage);
    }

    @Override
    public void publishCreatureDetail(CreatureDetailPublication publication) {
        CreatureDetailPublication safePublication = publication == null
                ? new CreatureDetailPublication(CreatureDetailStatus.STORAGE_ERROR, java.util.Optional.empty())
                : publication;
        currentCreatureDetail = new CreatureDetailResult(
                toLookupStatus(safePublication.status()),
                safePublication.detail().map(CreaturePublishedStateRepositoryAdapter::toPublishedCreatureDetail).orElse(null));
        notifyListeners(detailListeners, currentCreatureDetail);
    }

    private CreatureFilterOptionsResult currentFilterOptions() {
        return currentFilterOptions;
    }

    private CreatureCatalogPageResult currentCatalogPage() {
        return currentCatalogPage;
    }

    private CreatureDetailResult currentCreatureDetail() {
        return currentCreatureDetail;
    }

    private Runnable subscribeFilterOptionsListener(Consumer<CreatureFilterOptionsResult> listener) {
        Consumer<CreatureFilterOptionsResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        filterOptionsListeners.add(safeListener);
        return () -> filterOptionsListeners.remove(safeListener);
    }

    private Runnable subscribeCatalogListener(Consumer<CreatureCatalogPageResult> listener) {
        Consumer<CreatureCatalogPageResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        catalogListeners.add(safeListener);
        return () -> catalogListeners.remove(safeListener);
    }

    private Runnable subscribeDetailListener(Consumer<CreatureDetailResult> listener) {
        Consumer<CreatureDetailResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        detailListeners.add(safeListener);
        return () -> detailListeners.remove(safeListener);
    }

    private static <T> void notifyListeners(List<Consumer<T>> listeners, T result) {
        for (Consumer<T> listener : List.copyOf(listeners)) {
            listener.accept(result);
        }
    }

    private static CreatureReadStatus toReadStatus(FilterOptionsStatus status) {
        return status == FilterOptionsStatus.SUCCESS ? CreatureReadStatus.SUCCESS : CreatureReadStatus.STORAGE_ERROR;
    }

    private static CreatureQueryStatus toQueryStatus(CatalogPageStatus status) {
        return switch (status) {
            case SUCCESS -> CreatureQueryStatus.SUCCESS;
            case INVALID_QUERY -> CreatureQueryStatus.INVALID_QUERY;
            case STORAGE_ERROR -> CreatureQueryStatus.STORAGE_ERROR;
        };
    }

    private static CreatureLookupStatus toLookupStatus(CreatureDetailStatus status) {
        return switch (status) {
            case SUCCESS -> CreatureLookupStatus.SUCCESS;
            case NOT_FOUND -> CreatureLookupStatus.NOT_FOUND;
            case STORAGE_ERROR -> CreatureLookupStatus.STORAGE_ERROR;
        };
    }

    private static CreatureCatalogPage toPublishedCatalogPage(CreatureCatalogLookup.CatalogPage page) {
        CreatureCatalogLookup.CatalogPage safePage = page == null
                ? new CreatureCatalogLookup.CatalogPage(List.of(), 0, 50, 0)
                : page;
        return new CreatureCatalogPage(
                safePage.rows().stream().map(CreaturePublishedStateRepositoryAdapter::toPublishedCatalogRow).toList(),
                safePage.totalCount(),
                safePage.pageSize(),
                safePage.pageOffset());
    }

    private static src.domain.creatures.published.CreatureCatalogRow toPublishedCatalogRow(CreatureCatalogLookup.CatalogRow row) {
        CreatureCatalogLookup.CatalogRow safeRow =
                row == null ? new CreatureCatalogLookup.CatalogRow(0L, "", "", "", "", "", 0, 0, 0) : row;
        return new src.domain.creatures.published.CreatureCatalogRow(
                safeRow.id(),
                safeRow.name(),
                safeRow.size(),
                safeRow.creatureType(),
                safeRow.alignment(),
                safeRow.challengeRating(),
                safeRow.xp(),
                safeRow.hitPoints(),
                safeRow.armorClass());
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
                detail.actions().stream()
                        .map(action -> new CreatureActionDetail(
                                action.actionType(),
                                action.name(),
                                action.description(),
                                action.toHitBonus()))
                        .toList());
    }
}
