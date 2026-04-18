package src.view.creatures.interactor;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureCatalogPage;
import src.domain.creatures.api.CreatureCatalogQuery;
import src.domain.creatures.api.CreatureCatalogRow;
import src.domain.creatures.api.CreatureFilterOptions;
import src.domain.creatures.creaturesAPI;
import src.view.creatures.Model.CreaturesCatalogViewData;
import src.view.creatures.Model.CreatureFilterOptionsViewData;
import src.view.creatures.Model.CreaturesModel;

import java.util.List;
import java.util.Objects;

final class CreatureCatalogCoordinator {

    private static final int PAGE_SIZE = 50;

    private final creaturesAPI creatures;
    private final CreaturesModel model;

    private int currentOffset;

    CreatureCatalogCoordinator(creaturesAPI creatures, CreaturesModel model) {
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.model = Objects.requireNonNull(model, "model");
    }

    void initialize() {
        loadFilterOptions();
        refreshPage();
    }

    void applyFilters() {
        currentOffset = 0;
        refreshPage();
    }

    void clearFilters() {
        model.filters().reset();
        currentOffset = 0;
        refreshPage();
    }

    void previousPage() {
        currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
        refreshPage();
    }

    void nextPage() {
        currentOffset += PAGE_SIZE;
        refreshPage();
    }

    private void loadFilterOptions() {
        creaturesAPI.CreatureFilterOptionsResult result = creatures.loadFilterOptions();
        model.filters().applyOptions(toViewData(result.options()));
        if (result.status() != creaturesAPI.ReadStatus.SUCCESS) {
            model.status().show("Filter options could not be loaded. Catalog fallback is available.", true);
        }
    }

    private void refreshPage() {
        var filters = model.filters();
        var selection = filters.selection();
        creaturesAPI.CreatureCatalogPageResult result = creatures.searchCatalog(new CreatureCatalogQuery(
                selection.searchTextProperty().get(),
                selection.selectedChallengeRatingMinProperty().get(),
                selection.selectedChallengeRatingMaxProperty().get(),
                selection.selectedSizes(),
                selection.selectedTypes(),
                selection.selectedSubtypes(),
                selection.selectedBiomes(),
                selection.selectedAlignments(),
                creaturesAPI.CatalogSortField.NAME,
                creaturesAPI.SortDirection.ASCENDING,
                PAGE_SIZE,
                currentOffset
        ));
        if (result.status() == creaturesAPI.QueryStatus.INVALID_QUERY) {
            model.catalog().applyPage(new CreaturesCatalogViewData.Page(List.of(), "Invalid CR range.", false, false));
            model.status().show("The selected CR range is invalid.", true);
            currentOffset = 0;
            return;
        }
        if (result.status() != creaturesAPI.QueryStatus.SUCCESS) {
            model.catalog().applyPage(new CreaturesCatalogViewData.Page(List.of(), "Catalog unavailable.", false, false));
            model.status().show("Creature catalog could not be loaded.", true);
            return;
        }
        CreatureCatalogPage page = result.page();
        if (page.rows().isEmpty() && currentOffset > 0) {
            currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
            refreshPage();
            return;
        }
        model.catalog().applyPage(toViewData(page));
        if (page.totalCount() == 0) {
            model.status().show("No creatures match the current filters.", false);
            return;
        }
        model.status().clear();
    }

    private static CreaturesCatalogViewData.Page toViewData(CreatureCatalogPage page) {
        int total = page.totalCount();
        int offset = page.pageOffset();
        int endExclusive = Math.min(total, offset + page.rows().size());
        String summary = total == 0
                ? "No creatures found."
                : "Showing " + (offset + 1) + "-" + endExclusive + " of " + total + " creatures";
        return new CreaturesCatalogViewData.Page(
                page.rows().stream().map(CreatureCatalogCoordinator::toViewData).toList(),
                summary,
                offset > 0,
                offset + page.pageSize() < total
        );
    }

    private static CreaturesCatalogViewData.Row toViewData(CreatureCatalogRow row) {
        return new CreaturesCatalogViewData.Row(
                row.id(),
                row.name(),
                row.challengeRating(),
                row.creatureType(),
                row.size(),
                row.alignment(),
                row.xp(),
                row.hitPoints(),
                row.armorClass()
        );
    }

    private static CreatureFilterOptionsViewData toViewData(@Nullable CreatureFilterOptions options) {
        if (options == null) {
            return CreatureFilterOptionsViewData.empty();
        }
        return new CreatureFilterOptionsViewData(
                options.sizes(),
                options.types(),
                options.subtypes(),
                options.biomes(),
                options.alignments(),
                options.challengeRatings()
        );
    }
}
