package features.spells.api;

import features.spells.catalog.CatalogObject;
import features.spells.catalog.input.LoadFilterOptionsInput;
import features.spells.ui.SpellCatalogView;
import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

@SuppressWarnings("unused")
public final class SpellCatalogModule {
    private static final CatalogObject CATALOG_OBJECT = new CatalogObject();
    private final SpellCatalogView view = new SpellCatalogView();

    public void start(DetailsNavigator detailsNavigator) {
        view.setDetailsNavigator(detailsNavigator);
        Task<LoadFilterOptionsInput.LoadedFilterOptionsInput> task = new Task<>() {
            @Override protected LoadFilterOptionsInput.LoadedFilterOptionsInput call() {
                return CATALOG_OBJECT.loadFilterOptions(new LoadFilterOptionsInput());
            }
        };
        UiAsyncTasks.submit(task, result -> {
            if (!result.success()) {
                UiErrorReporter.reportBackgroundFailure(
                        "SpellCatalogModule.start() loadFilterOptions failed",
                        new IllegalStateException("CatalogObject.loadFilterOptions() failed"));
            }
            LoadFilterOptionsInput.LoadedFilterOptionsInput filterData = result;
            if (filterData == null) {
                UiErrorReporter.reportBackgroundFailure(
                        "SpellCatalogModule.start() loadFilterOptions returned null value",
                        null);
                return;
            }
            view.setFilterData(filterData);
        }, throwable -> UiErrorReporter.reportBackgroundFailure("SpellCatalogModule.start()", throwable));
    }

    public AppView view() {
        return view;
    }
}
