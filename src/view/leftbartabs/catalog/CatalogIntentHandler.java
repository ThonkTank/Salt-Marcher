package src.view.leftbartabs.catalog;

import java.util.Objects;
import java.util.function.Consumer;

final class CatalogIntentHandler {

    private final CatalogPresentationModel presentationModel;
    private Runnable filterOptionsListener = () -> {};
    private Consumer<CatalogPresentationModel.SearchInput> searchListener = ignored -> {};

    CatalogIntentHandler(CatalogPresentationModel presentationModel) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
    }

    void onLoadFilterOptions(Runnable listener) {
        filterOptionsListener = listener == null ? () -> {} : listener;
    }

    void onSearchRequested(Consumer<CatalogPresentationModel.SearchInput> listener) {
        searchListener = listener == null ? ignored -> {} : listener;
    }

    void loadInitial() {
        if (!presentationModel.markInitialLoad()) {
            return;
        }
        filterOptionsListener.run();
        searchListener.accept(presentationModel.currentSearchInput());
    }

    void applyCreatureFilters(CatalogPresentationModel.CreatureFilters filters) {
        presentationModel.applyCreatureFilters(filters);
        searchListener.accept(presentationModel.currentSearchInput());
    }

    void selectSort(String sortKey) {
        presentationModel.selectSort(sortKey);
        searchListener.accept(presentationModel.currentSearchInput());
    }

    void previousPage() {
        presentationModel.previousPage();
        searchListener.accept(presentationModel.currentSearchInput());
    }

    void nextPage() {
        presentationModel.nextPage();
        searchListener.accept(presentationModel.currentSearchInput());
    }
}
