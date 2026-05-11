package src.data.creatures.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.creatures.published.CreatureCatalogModel;
import src.domain.creatures.published.CreatureCatalogPage;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureFilterOptions;
import src.domain.creatures.published.CreatureFilterOptionsModel;
import src.domain.creatures.published.CreatureFilterOptionsResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.CreatureReadStatus;
import src.domain.creatures.model.catalog.repository.CreaturesPublishedStateRepository;

public final class CreaturePublishedStateRepositoryAdapter implements CreaturesPublishedStateRepository {

    private static final String LISTENER_PARAMETER = "listener";

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
            new CreatureFilterOptionsResult(CreatureReadStatus.STORAGE_ERROR, CreatureFilterOptions.empty());
    private CreatureCatalogPageResult currentCatalogPage =
            new CreatureCatalogPageResult(CreatureQueryStatus.STORAGE_ERROR, CreatureCatalogPage.empty(50, 0));
    private CreatureDetailResult currentCreatureDetail =
            new CreatureDetailResult(CreatureLookupStatus.STORAGE_ERROR, null);

    @Override
    public void publishFilterOptions(CreatureFilterOptionsResult result) {
        currentFilterOptions = result == null
                ? new CreatureFilterOptionsResult(CreatureReadStatus.STORAGE_ERROR, null)
                : result;
        notifyListeners(filterOptionsListeners, currentFilterOptions);
    }

    @Override
    public void publishCatalogPage(CreatureCatalogPageResult result) {
        currentCatalogPage = result == null
                ? new CreatureCatalogPageResult(CreatureQueryStatus.STORAGE_ERROR, null)
                : result;
        notifyListeners(catalogListeners, currentCatalogPage);
    }

    @Override
    public void publishCreatureDetail(CreatureDetailResult result) {
        currentCreatureDetail = result == null
                ? new CreatureDetailResult(CreatureLookupStatus.STORAGE_ERROR, null)
                : result;
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
