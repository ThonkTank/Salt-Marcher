package src.view.leftbartabs.catalog;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.creatures.published.CreatureCatalogPage;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureQueryStatus;

public final class CatalogMainContentModel {

    private static final int PAGE_SIZE = 50;

    private final ReadOnlyObjectWrapper<CatalogContributionModel.MainProjection> projection =
            new ReadOnlyObjectWrapper<>(CatalogContributionModel.MainProjection.initial());
    private List<CatalogContributionModel.CatalogRow> rows = List.of();
    private CatalogContributionModel.SortOption selectedSort = CatalogContributionModel.SortOption.NAME_ASC;
    private String placeholderText = "Lade Monster...";
    private int pageOffset;
    private int totalCount;

    ReadOnlyObjectProperty<CatalogContributionModel.MainProjection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void selectSort(String sortKey) {
        selectedSort = CatalogContributionModel.SortOption.fromKey(sortKey);
        pageOffset = 0;
        refreshProjection();
    }

    void shiftPage(int pageShift) {
        if (pageShift < 0 && pageOffset > 0) {
            pageOffset = Math.max(0, pageOffset - PAGE_SIZE);
        } else if (pageShift > 0 && pageOffset + PAGE_SIZE < totalCount) {
            pageOffset += PAGE_SIZE;
        }
        refreshProjection();
    }

    void applySearchResult(CreatureCatalogPageResult result) {
        CreatureCatalogPage page = result == null ? CreatureCatalogPage.empty(PAGE_SIZE, pageOffset) : result.page();
        if (page == null) {
            page = CreatureCatalogPage.empty(PAGE_SIZE, pageOffset);
        }
        totalCount = Math.max(0, page.totalCount());
        rows = page.rows().stream().map(CatalogContributionModel.CatalogRow::fromCreature).toList();
        placeholderText = switch (result == null ? CreatureQueryStatus.STORAGE_ERROR : result.status()) {
            case SUCCESS -> "Keine Monster gefunden";
            case INVALID_QUERY -> "Filter sind ungültig";
            default -> "Fehler beim Laden";
        };
        refreshProjection();
    }

    void beginSearch() {
        placeholderText = "Lade Monster...";
        refreshProjection();
    }

    CatalogContributionModel.SearchRequest currentSearchRequest(CatalogContributionModel.CreatureFilters filters) {
        CatalogContributionModel.CreatureFilters safeFilters = filters == null
                ? CatalogContributionModel.CreatureFilters.empty()
                : filters;
        return new CatalogContributionModel.SearchRequest(
                safeFilters.nameQuery(),
                safeFilters.challengeRatingMin(),
                safeFilters.challengeRatingMax(),
                safeFilters.sizes(),
                safeFilters.types(),
                safeFilters.subtypes(),
                safeFilters.biomes(),
                safeFilters.alignments(),
                selectedSort.field(),
                selectedSort.direction(),
                pageOffset);
    }

    private void refreshProjection() {
        projection.set(CatalogContributionModel.MainProjection.from(
                rows,
                selectedSort,
                pageOffset,
                totalCount,
                placeholderText));
    }
}
