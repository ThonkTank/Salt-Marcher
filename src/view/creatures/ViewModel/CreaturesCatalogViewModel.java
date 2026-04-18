package src.view.creatures.ViewModel;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.api.CreatureCatalogPage;
import src.domain.creatures.api.CreatureCatalogPageResult;
import src.domain.creatures.api.CreatureCatalogQuery;
import src.domain.creatures.api.CreatureCatalogRow;
import src.domain.creatures.api.CreatureCatalogSortField;
import src.domain.creatures.api.CreatureDetail;
import src.domain.creatures.api.CreatureDetailResult;
import src.domain.creatures.api.CreatureFilterOptions;
import src.domain.creatures.api.CreatureFilterOptionsResult;
import src.domain.creatures.api.CreatureLookupStatus;
import src.domain.creatures.api.CreatureQueryStatus;
import src.domain.creatures.api.CreatureReadStatus;
import src.domain.creatures.api.CreatureSortDirection;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class CreaturesCatalogViewModel {

    private static final int PAGE_SIZE = 50;

    private final CreaturesApplicationService creatures;
    private final CreatureInspectorPublisher inspectorPublisher;
    private final List<Runnable> listeners = new ArrayList<>();

    private CreaturesCatalogSnapshot snapshot = CreaturesCatalogSnapshot.empty();
    private CreatureFilterSelection activeSelection = CreatureFilterSelection.empty();
    private int currentOffset;

    public CreaturesCatalogViewModel(CreaturesApplicationService creatures, CreatureInspectorPublisher inspectorPublisher) {
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.inspectorPublisher = Objects.requireNonNull(inspectorPublisher, "inspectorPublisher");
    }

    public CreaturesCatalogSnapshot snapshot() {
        return snapshot;
    }

    public void addChangeListener(Runnable listener) {
        listeners.add(Objects.requireNonNull(listener, "listener"));
    }

    public void initialize() {
        loadFilterOptions();
        refreshPage();
    }

    public void applyFilters(CreatureFilterSelection selection) {
        activeSelection = selection == null ? CreatureFilterSelection.empty() : selection;
        currentOffset = 0;
        refreshPage();
    }

    public void previousPage() {
        currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
        refreshPage();
    }

    public void nextPage() {
        currentOffset += PAGE_SIZE;
        refreshPage();
    }

    public void selectCreature(@Nullable Long creatureId) {
        if (creatureId == null || creatureId <= 0) {
            return;
        }
        Object inspectorKey = "creatures:" + creatureId;
        if (inspectorPublisher.isShowing(inspectorKey)) {
            return;
        }
        CreatureDetailResult result = creatures.loadCreatureDetail(creatureId);
        if (result.status() == CreatureLookupStatus.NOT_FOUND || result.detail() == null) {
            updateStatus("Creature detail is not available.", true);
            return;
        }
        if (result.status() != CreatureLookupStatus.SUCCESS) {
            updateStatus("Creature detail could not be loaded.", true);
            return;
        }
        CreatureDetail detail = result.detail();
        inspectorPublisher.show(detail, inspectorKey);
        clearStatus();
    }

    private void loadFilterOptions() {
        CreatureFilterOptionsResult result = creatures.loadFilterOptions();
        snapshot = snapshot.withFilterOptions(toViewData(result.options()));
        if (result.status() != CreatureReadStatus.SUCCESS) {
            snapshot = snapshot.withStatus(new CreaturesStatusViewData(
                    "Filter options could not be loaded. Catalog fallback is available.",
                    true,
                    true));
        }
        notifyListeners();
    }

    private void refreshPage() {
        CreatureCatalogPageResult result = creatures.searchCatalog(new CreatureCatalogQuery(
                activeSelection.searchText(),
                activeSelection.selectedChallengeRatingMin(),
                activeSelection.selectedChallengeRatingMax(),
                activeSelection.selectedSizes(),
                activeSelection.selectedTypes(),
                activeSelection.selectedSubtypes(),
                activeSelection.selectedBiomes(),
                activeSelection.selectedAlignments(),
                CreatureCatalogSortField.NAME,
                CreatureSortDirection.ASCENDING,
                PAGE_SIZE,
                currentOffset
        ));
        if (result.status() == CreatureQueryStatus.INVALID_QUERY) {
            currentOffset = 0;
            snapshot = snapshot
                    .withPage(CreaturesCatalogViewData.emptyPage("Invalid CR range."))
                    .withStatus(new CreaturesStatusViewData("The selected CR range is invalid.", true, true));
            notifyListeners();
            return;
        }
        if (result.status() != CreatureQueryStatus.SUCCESS) {
            snapshot = snapshot
                    .withPage(CreaturesCatalogViewData.emptyPage("Catalog unavailable."))
                    .withStatus(new CreaturesStatusViewData("Creature catalog could not be loaded.", true, true));
            notifyListeners();
            return;
        }
        CreatureCatalogPage page = result.page();
        if (page.rows().isEmpty() && currentOffset > 0) {
            currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
            refreshPage();
            return;
        }
        snapshot = snapshot.withPage(toViewData(page));
        if (page.totalCount() == 0) {
            snapshot = snapshot.withStatus(new CreaturesStatusViewData("No creatures match the current filters.", true, false));
            notifyListeners();
            return;
        }
        snapshot = snapshot.withStatus(CreaturesStatusViewData.hidden());
        notifyListeners();
    }

    private void updateStatus(String text, boolean error) {
        snapshot = snapshot.withStatus(new CreaturesStatusViewData(text, text != null && !text.isBlank(), error));
        notifyListeners();
    }

    private void clearStatus() {
        snapshot = snapshot.withStatus(CreaturesStatusViewData.hidden());
        notifyListeners();
    }

    private void notifyListeners() {
        for (Runnable listener : listeners) {
            listener.run();
        }
    }

    private static CreaturesCatalogViewData.Page toViewData(CreatureCatalogPage page) {
        int total = page.totalCount();
        int offset = page.pageOffset();
        int endExclusive = Math.min(total, offset + page.rows().size());
        String summary = total == 0
                ? "No creatures found."
                : "Showing " + (offset + 1) + "-" + endExclusive + " of " + total + " creatures";
        return new CreaturesCatalogViewData.Page(
                page.rows().stream().map(CreaturesCatalogViewModel::toViewData).toList(),
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
