package features.items.service;

import database.DatabaseManager;
import features.items.api.ItemCatalogService;
import features.items.model.Item;
import features.items.repository.ItemRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

public final class ItemCatalogApplicationService {
    private static final Logger LOGGER = Logger.getLogger(ItemCatalogApplicationService.class.getName());

    private ItemCatalogApplicationService() {
        throw new AssertionError("No instances");
    }

    public static ItemCatalogService.ServiceResult<ItemCatalogService.FilterOptions> loadFilterOptions() {
        try (Connection conn = DatabaseManager.getConnection()) {
            return ItemCatalogService.ServiceResult.ok(new ItemCatalogService.FilterOptions(
                    ItemRepository.getDistinctCategories(conn),
                    ItemRepository.getDistinctSubcategories(conn),
                    ItemRepository.getDistinctRarities(conn),
                    ItemRepository.getDistinctTags(conn),
                    ItemRepository.getDistinctSources(conn)));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "ItemCatalogApplicationService.loadFilterOptions(): DB access failed", e);
            return ItemCatalogService.ServiceResult.dbAccessFailed(
                    new ItemCatalogService.FilterOptions(List.of(), List.of(), List.of(), List.of(), List.of()));
        }
    }

    public static ItemCatalogService.ServiceResult<ItemCatalogService.PageResult> searchItems(
            ItemCatalogService.FilterCriteria criteria,
            List<Long> excludeIds,
            ItemCatalogService.PageRequest pageRequest) {
        ItemCatalogService.FilterCriteria effectiveCriteria =
                criteria != null ? criteria : ItemCatalogService.FilterCriteria.empty();
        ItemCatalogService.PageRequest effectivePage =
                pageRequest != null ? pageRequest : new ItemCatalogService.PageRequest("name", "ASC", 50, 0);
        try (Connection conn = DatabaseManager.getConnection()) {
            ItemRepository.SearchResult result = ItemRepository.searchWithFiltersAndCount(
                    conn,
                    effectiveCriteria.nameQuery(),
                    effectiveCriteria.minCostCp(),
                    effectiveCriteria.maxCostCp(),
                    effectiveCriteria.magicOnly(),
                    effectiveCriteria.attunementOnly(),
                    effectiveCriteria.categories(),
                    effectiveCriteria.subcategories(),
                    effectiveCriteria.rarities(),
                    effectiveCriteria.sources(),
                    effectiveCriteria.tags(),
                    excludeIds,
                    effectivePage.sortColumn(),
                    effectivePage.sortDirection(),
                    effectivePage.limit(),
                    effectivePage.offset());
            return ItemCatalogService.ServiceResult.ok(new ItemCatalogService.PageResult(
                    result.items().stream().map(ItemCatalogApplicationService::toSummary).toList(),
                    result.totalCount()));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "ItemCatalogApplicationService.searchItems(): DB access failed", e);
            return ItemCatalogService.ServiceResult.dbAccessFailed(new ItemCatalogService.PageResult(List.of(), 0));
        }
    }

    public static ItemCatalogService.ServiceResult<ItemCatalogService.ItemDetails> getItem(Long itemId) {
        try (Connection conn = DatabaseManager.getConnection()) {
            Item item = ItemRepository.getItem(conn, itemId);
            return ItemCatalogService.ServiceResult.ok(item != null ? toDetails(item) : null);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "ItemCatalogApplicationService.getItem(): DB access failed", e);
            return ItemCatalogService.ServiceResult.dbAccessFailed(null);
        }
    }

    public static ItemCatalogService.ServiceResult<List<ItemCatalogService.ItemSummary>> searchByName(String query, int limit) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return ItemCatalogService.ServiceResult.ok(
                    ItemRepository.searchByName(conn, query, limit).stream()
                            .map(ItemCatalogApplicationService::toSummary)
                            .toList());
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "ItemCatalogApplicationService.searchByName(): DB access failed", e);
            return ItemCatalogService.ServiceResult.dbAccessFailed(List.of());
        }
    }

    private static ItemCatalogService.ItemSummary toSummary(Item item) {
        if (item == null || item.Id == null) {
            return new ItemCatalogService.ItemSummary(-1L, "", "", "", false, "", false, 0, "");
        }
        return new ItemCatalogService.ItemSummary(
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

    private static ItemCatalogService.ItemDetails toDetails(Item item) {
        return new ItemCatalogService.ItemDetails(
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
