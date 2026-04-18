package src.view.creatures.ViewModel;

public record CreaturesCatalogSnapshot(
        CreatureFilterOptionsViewData filterOptions,
        CreaturesCatalogViewData.Page page,
        CreaturesStatusViewData status
) {

    public CreaturesCatalogSnapshot {
        filterOptions = filterOptions == null ? CreatureFilterOptionsViewData.empty() : filterOptions;
        page = page == null ? CreaturesCatalogViewData.emptyPage("No creatures loaded.") : page;
        status = status == null ? CreaturesStatusViewData.hidden() : status;
    }

    public static CreaturesCatalogSnapshot empty() {
        return new CreaturesCatalogSnapshot(
                CreatureFilterOptionsViewData.empty(),
                CreaturesCatalogViewData.emptyPage("No creatures loaded."),
                CreaturesStatusViewData.hidden());
    }

    public CreaturesCatalogSnapshot withFilterOptions(CreatureFilterOptionsViewData nextFilterOptions) {
        return new CreaturesCatalogSnapshot(nextFilterOptions, page, status);
    }

    public CreaturesCatalogSnapshot withPage(CreaturesCatalogViewData.Page nextPage) {
        return new CreaturesCatalogSnapshot(filterOptions, nextPage, status);
    }

    public CreaturesCatalogSnapshot withStatus(CreaturesStatusViewData nextStatus) {
        return new CreaturesCatalogSnapshot(filterOptions, page, nextStatus);
    }
}
