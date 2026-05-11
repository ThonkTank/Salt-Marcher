package src.data.creatures.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.creatures.model.catalog.model.CreatureCatalogData;
import src.domain.creatures.model.catalog.repository.CreaturesPublishedStateRepository;
import src.domain.creatures.published.CreatureCatalogModel;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureFilterOptionsModel;
import src.domain.creatures.published.CreatureFilterOptionsResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.CreatureReadStatus;

public final class CreaturePublishedStateRepositoryAdapter implements CreaturesPublishedStateRepository {

    private static final String LISTENER_PARAMETER = "listener";
    private static final CreatureCatalogData.DistinctFilterValues EMPTY_FILTER_VALUES =
            CreatureCatalogData.emptyFilterValues();
    private static final CreatureCatalogData.CatalogPageData EMPTY_CATALOG_PAGE =
            CreatureCatalogData.emptyCatalogPage(50, 0);

    private final List<Consumer<CreatureFilterOptionsResult>> filterOptionsListeners = new ArrayList<>();
    private final List<Consumer<CreatureCatalogPageResult>> catalogListeners = new ArrayList<>();
    private final List<Consumer<CreatureDetailResult>> detailListeners = new ArrayList<>();

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
            new CreatureFilterOptionsResult(
                    CreatureReadStatus.STORAGE_ERROR,
                    CreaturePublishedStateMapper.toPublishedFilterOptions(EMPTY_FILTER_VALUES, List.of()));
    private CreatureCatalogPageResult currentCatalogPage =
            new CreatureCatalogPageResult(
                    CreatureQueryStatus.STORAGE_ERROR,
                    CreaturePublishedStateMapper.toPublishedCatalogPage(EMPTY_CATALOG_PAGE));
    private CreatureDetailResult currentCreatureDetail =
            new CreatureDetailResult(CreatureLookupStatus.STORAGE_ERROR, null);

    @Override
    public void publishFilterOptions(FilterOptionsPublication result) {
        FilterOptionsPublication safeResult = result == null
                ? new FilterOptionsPublication(STORAGE_ERROR, EMPTY_FILTER_VALUES, List.of())
                : result;
        CreatureCatalogData.DistinctFilterValues values = safeResult.values();
        currentFilterOptions = new CreatureFilterOptionsResult(
                CreaturePublishedStateMapper.toReadStatus(safeResult.status()),
                CreaturePublishedStateMapper.toPublishedFilterOptions(values, safeResult.challengeRatings()));
        notifyListeners(filterOptionsListeners, currentFilterOptions);
    }

    @Override
    public void publishCatalogPage(CatalogPagePublication result) {
        CatalogPagePublication safeResult = result == null
                ? new CatalogPagePublication(STORAGE_ERROR, EMPTY_CATALOG_PAGE)
                : result;
        currentCatalogPage = new CreatureCatalogPageResult(
                CreaturePublishedStateMapper.toQueryStatus(safeResult.status()),
                CreaturePublishedStateMapper.toPublishedCatalogPage(safeResult.page()));
        notifyListeners(catalogListeners, currentCatalogPage);
    }

    @Override
    public void publishCreatureDetail(CreatureDetailPublication result) {
        CreatureDetailPublication safeResult = result == null
                ? new CreatureDetailPublication(STORAGE_ERROR, null)
                : result;
        currentCreatureDetail = new CreatureDetailResult(
                CreaturePublishedStateMapper.toLookupStatus(safeResult.status()),
                CreaturePublishedStateMapper.toPublishedCreatureDetail(safeResult.detail()));
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
}
