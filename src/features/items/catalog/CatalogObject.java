package features.items.catalog;

import database.DatabaseManager;
import features.items.catalog.input.LoadFilterOptionsInput;
import features.items.catalog.input.LoadItemInput;
import features.items.catalog.input.SearchItemsByNameInput;
import features.items.catalog.input.SearchItemsInput;
import features.items.model.Item;
import features.items.repository.ItemRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Canonical root seam for item catalog reads shared by shell and loot-table
 * consumers.
 */
@SuppressWarnings("unused")
public final class CatalogObject {
    private static final Logger LOGGER = Logger.getLogger(CatalogObject.class.getName());

    public LoadFilterOptionsInput.LoadedFilterOptionsInput loadFilterOptions(LoadFilterOptionsInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new LoadFilterOptionsInput.LoadedFilterOptionsInput(
                    true,
                    ItemRepository.getDistinctCategories(conn),
                    ItemRepository.getDistinctSubcategories(conn),
                    ItemRepository.getDistinctRarities(conn),
                    ItemRepository.getDistinctTags(conn),
                    ItemRepository.getDistinctSources(conn));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CatalogObject.loadFilterOptions(): DB access failed", e);
            return new LoadFilterOptionsInput.LoadedFilterOptionsInput(
                    false,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of());
        }
    }

    public SearchItemsInput.SearchedItemsInput searchItems(SearchItemsInput input) {
        SearchItemsInput.CriteriaInput criteria = input.criteria() != null
                ? input.criteria()
                : new SearchItemsInput.CriteriaInput(
                        null,
                        null,
                        null,
                        false,
                        false,
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of());
        SearchItemsInput.PageInput page = input.page() != null
                ? input.page()
                : new SearchItemsInput.PageInput("name", "ASC", 50, 0);

        try (Connection conn = DatabaseManager.getConnection()) {
            ItemRepository.SearchResult result = ItemRepository.searchWithFiltersAndCount(
                    conn,
                    criteria.nameQuery(),
                    criteria.minCostCp(),
                    criteria.maxCostCp(),
                    criteria.magicOnly(),
                    criteria.attunementOnly(),
                    criteria.categories(),
                    criteria.subcategories(),
                    criteria.rarities(),
                    criteria.sources(),
                    criteria.tags(),
                    input.excludeIds(),
                    page.sortColumn(),
                    page.sortDirection(),
                    page.limit(),
                    page.offset());
            return new SearchItemsInput.SearchedItemsInput(
                    true,
                    result.items().stream().map(CatalogObject::toSummary).toList(),
                    result.totalCount());
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CatalogObject.searchItems(): DB access failed", e);
            return new SearchItemsInput.SearchedItemsInput(false, List.of(), 0);
        }
    }

    public SearchItemsByNameInput.SearchedItemsByNameInput searchItemsByName(SearchItemsByNameInput input) {
        String query = input.query();
        if (query == null || query.isBlank()) {
            return new SearchItemsByNameInput.SearchedItemsByNameInput(true, List.of());
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return new SearchItemsByNameInput.SearchedItemsByNameInput(
                    true,
                    ItemRepository.searchByName(conn, query, input.limit()).stream()
                            .map(CatalogObject::toSummary)
                            .toList());
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CatalogObject.searchItemsByName(): DB access failed", e);
            return new SearchItemsByNameInput.SearchedItemsByNameInput(false, List.of());
        }
    }

    public LoadItemInput.LoadedItemInput loadItem(LoadItemInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            Item item = ItemRepository.getItem(conn, input.itemId());
            return new LoadItemInput.LoadedItemInput(
                    true,
                    item != null ? toDetails(item) : null);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CatalogObject.loadItem(): DB access failed", e);
            return new LoadItemInput.LoadedItemInput(false, null);
        }
    }

    private static SearchItemsInput.ItemSummaryInput toSummary(Item item) {
        if (item == null || item.Id == null) {
            return new SearchItemsInput.ItemSummaryInput(-1L, "", "", "", false, "", false, 0, "");
        }
        return new SearchItemsInput.ItemSummaryInput(
                item.Id,
                item.Name,
                item.Category,
                item.Subcategory,
                item.IsMagic,
                item.Rarity,
                item.RequiresAttunement,
                item.CostCp,
                item.Cost);
    }

    private static LoadItemInput.ItemDetailsInput toDetails(Item item) {
        return new LoadItemInput.ItemDetailsInput(
                item.Id != null ? item.Id : -1L,
                item.Name,
                item.Category,
                item.Subcategory,
                item.IsMagic,
                item.Rarity,
                item.RequiresAttunement,
                item.AttunementCondition,
                item.Cost,
                item.CostCp,
                item.Weight,
                item.Damage,
                item.Properties,
                item.ArmorClass,
                item.Description,
                item.Source,
                item.Tags == null ? List.of() : List.copyOf(item.Tags));
    }
}
