package features.spells.api;

import features.spells.ui.SpellCatalogView;
import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

public final class SpellCatalogModule {
    private final SpellCatalogView view = new SpellCatalogView();

    public void start(DetailsNavigator detailsNavigator) {
        view.setDetailsNavigator(detailsNavigator);
        Task<SpellCatalogService.ServiceResult<SpellCatalogService.FilterOptions>> task = new Task<>() {
            @Override protected SpellCatalogService.ServiceResult<SpellCatalogService.FilterOptions> call() {
                return SpellCatalogService.loadFilterOptions();
            }
        };
        UiAsyncTasks.submit(task, result -> {
            if (!result.isOk()) {
                UiErrorReporter.reportBackgroundFailure(
                        "SpellCatalogModule.start() loadFilterOptions failed",
                        new IllegalStateException("SpellCatalogService status: " + result.status()));
            }
            SpellCatalogService.FilterOptions filterData = result.value();
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
