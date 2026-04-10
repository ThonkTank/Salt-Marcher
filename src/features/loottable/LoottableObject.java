package features.loottable;

import database.DatabaseManager;
import features.loottable.input.AddItemInput;
import features.loottable.input.CreateTableInput;
import features.loottable.input.DeleteTableInput;
import features.loottable.input.LoadTableInput;
import features.loottable.input.LoadTablesInput;
import features.loottable.input.LoadWeightedItemsInput;
import features.loottable.input.RemoveItemInput;
import features.loottable.input.RenameTableInput;
import features.loottable.input.UpdateWeightInput;
import features.loottable.model.LootTable;
import features.loottable.repository.LootTableRepository;
import features.loottable.service.LootTableNameNormalizer;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Canonical root seam for loot-table reads and mutations shared by editor, API,
 * and encounter consumers.
 */
@SuppressWarnings("unused")
public final class LoottableObject {
    private static final Logger LOGGER = Logger.getLogger(LoottableObject.class.getName());
    private static final int MIN_WEIGHT = 1;
    private static final int MAX_WEIGHT = 10;

    public LoadTablesInput.LoadedTablesInput loadTables(LoadTablesInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new LoadTablesInput.LoadedTablesInput(
                    true,
                    LootTableRepository.getAll(conn).stream()
                            .map(LoottableObject::toSummary)
                            .toList());
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "LoottableObject.loadTables(): DB access failed", e);
            return new LoadTablesInput.LoadedTablesInput(false, List.of());
        }
    }

    public LoadTableInput.LoadedTableInput loadTable(LoadTableInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            LootTable table = LootTableRepository.getWithEntries(conn, input.tableId());
            if (table == null) {
                return new LoadTableInput.LoadedTableInput(LoadTableInput.Status.NOT_FOUND, null);
            }
            return new LoadTableInput.LoadedTableInput(LoadTableInput.Status.SUCCESS, toTable(table));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "LoottableObject.loadTable(): DB access failed", e);
            return new LoadTableInput.LoadedTableInput(LoadTableInput.Status.STORAGE_ERROR, null);
        }
    }

    public CreateTableInput.CreatedTableInput createTable(CreateTableInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            String normalizedName = LootTableNameNormalizer.normalizeForStorage(input.name());
            if (normalizedName.isBlank()) {
                return new CreateTableInput.CreatedTableInput(CreateTableInput.Status.VALIDATION_ERROR, -1L);
            }
            if (LootTableRepository.existsByNormalizedName(conn, normalizedName, null)) {
                return new CreateTableInput.CreatedTableInput(CreateTableInput.Status.DUPLICATE_NAME, -1L);
            }
            long tableId = LootTableRepository.create(conn, normalizedName, input.description());
            return new CreateTableInput.CreatedTableInput(CreateTableInput.Status.SUCCESS, tableId);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "LoottableObject.createTable(): DB access failed", e);
            return new CreateTableInput.CreatedTableInput(
                    isDuplicateNameViolation(e) ? CreateTableInput.Status.DUPLICATE_NAME : CreateTableInput.Status.STORAGE_ERROR,
                    -1L);
        }
    }

    public RenameTableInput.RenamedTableInput renameTable(RenameTableInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            String normalizedName = LootTableNameNormalizer.normalizeForStorage(input.name());
            if (normalizedName.isBlank()) {
                return new RenameTableInput.RenamedTableInput(RenameTableInput.Status.VALIDATION_ERROR);
            }
            if (LootTableRepository.existsByNormalizedName(conn, normalizedName, input.tableId())) {
                return new RenameTableInput.RenamedTableInput(RenameTableInput.Status.DUPLICATE_NAME);
            }
            LootTableRepository.rename(conn, input.tableId(), normalizedName);
            return new RenameTableInput.RenamedTableInput(RenameTableInput.Status.SUCCESS);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "LoottableObject.renameTable(): DB access failed", e);
            return new RenameTableInput.RenamedTableInput(
                    isDuplicateNameViolation(e) ? RenameTableInput.Status.DUPLICATE_NAME : RenameTableInput.Status.STORAGE_ERROR);
        }
    }

    public DeleteTableInput.DeletedTableInput deleteTable(DeleteTableInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            LootTableRepository.delete(conn, input.tableId());
            return new DeleteTableInput.DeletedTableInput(DeleteTableInput.Status.SUCCESS);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "LoottableObject.deleteTable(): DB access failed", e);
            return new DeleteTableInput.DeletedTableInput(DeleteTableInput.Status.STORAGE_ERROR);
        }
    }

    public AddItemInput.AddedItemInput addItem(AddItemInput input) {
        int weight = input.weight() == null ? 1 : input.weight();
        if (!isValidWeight(weight) || input.itemId() == null || input.itemId() <= 0) {
            return new AddItemInput.AddedItemInput(AddItemInput.Status.VALIDATION_ERROR);
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            if (!hasPositiveCost(conn, input.itemId())) {
                return new AddItemInput.AddedItemInput(AddItemInput.Status.VALIDATION_ERROR);
            }
            LootTableRepository.addEntry(conn, input.tableId(), input.itemId(), weight);
            return new AddItemInput.AddedItemInput(AddItemInput.Status.SUCCESS);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "LoottableObject.addItem(): DB access failed", e);
            if (isDuplicateEntryViolation(e)) {
                return new AddItemInput.AddedItemInput(AddItemInput.Status.DUPLICATE_ENTRY);
            }
            return new AddItemInput.AddedItemInput(
                    isWeightConstraintViolation(e) ? AddItemInput.Status.VALIDATION_ERROR : AddItemInput.Status.STORAGE_ERROR);
        }
    }

    public RemoveItemInput.RemovedItemInput removeItem(RemoveItemInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            LootTableRepository.removeEntry(conn, input.tableId(), input.itemId());
            return new RemoveItemInput.RemovedItemInput(RemoveItemInput.Status.SUCCESS);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "LoottableObject.removeItem(): DB access failed", e);
            return new RemoveItemInput.RemovedItemInput(RemoveItemInput.Status.STORAGE_ERROR);
        }
    }

    public UpdateWeightInput.UpdatedWeightInput updateWeight(UpdateWeightInput input) {
        int weight = input.weight() == null ? 0 : input.weight();
        if (!isValidWeight(weight)) {
            return new UpdateWeightInput.UpdatedWeightInput(UpdateWeightInput.Status.VALIDATION_ERROR);
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            LootTableRepository.updateWeight(conn, input.tableId(), input.itemId(), weight);
            return new UpdateWeightInput.UpdatedWeightInput(UpdateWeightInput.Status.SUCCESS);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "LoottableObject.updateWeight(): DB access failed", e);
            return new UpdateWeightInput.UpdatedWeightInput(
                    isWeightConstraintViolation(e) ? UpdateWeightInput.Status.VALIDATION_ERROR : UpdateWeightInput.Status.STORAGE_ERROR);
        }
    }

    public LoadWeightedItemsInput.LoadedWeightedItemsInput loadWeightedItems(LoadWeightedItemsInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new LoadWeightedItemsInput.LoadedWeightedItemsInput(
                    LoadWeightedItemsInput.Status.SUCCESS,
                    LootTableRepository.getWeightedItems(conn, input.lootTableId()).stream()
                            .map(LoottableObject::toWeightedItem)
                            .toList());
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "LoottableObject.loadWeightedItems(): DB access failed", e);
            return new LoadWeightedItemsInput.LoadedWeightedItemsInput(
                    LoadWeightedItemsInput.Status.STORAGE_ERROR,
                    List.of());
        }
    }

    private static LoadTablesInput.TableSummaryInput toSummary(LootTable table) {
        return new LoadTablesInput.TableSummaryInput(
                table.tableId,
                table.name,
                table.description);
    }

    private static LoadTableInput.TableInput toTable(LootTable table) {
        return new LoadTableInput.TableInput(
                table.tableId,
                table.name,
                table.description,
                table.entries == null ? List.of() : table.entries.stream().map(LoottableObject::toEntry).toList());
    }

    private static LoadTableInput.EntryInput toEntry(LootTable.Entry entry) {
        return new LoadTableInput.EntryInput(
                entry.itemId(),
                entry.itemName(),
                entry.category(),
                entry.rarity(),
                entry.costCp(),
                entry.costDisplay(),
                entry.weight());
    }

    private static LoadWeightedItemsInput.WeightedItemInput toWeightedItem(LootTable.Entry entry) {
        return new LoadWeightedItemsInput.WeightedItemInput(
                entry.itemId(),
                entry.itemName(),
                entry.category(),
                entry.rarity(),
                entry.costCp(),
                entry.costDisplay(),
                entry.weight());
    }

    private static boolean isDuplicateNameViolation(SQLException e) {
        String lower = e.getMessage() == null ? "" : e.getMessage().toLowerCase();
        return e.getErrorCode() == 19 && (lower.contains("loot_tables") || lower.contains("idx_loot_tables_name_norm_unique"));
    }

    private static boolean isWeightConstraintViolation(SQLException e) {
        String lower = e.getMessage() == null ? "" : e.getMessage().toLowerCase();
        return e.getErrorCode() == 19 && lower.contains("loot_table_entries") && lower.contains("weight");
    }

    private static boolean isDuplicateEntryViolation(SQLException e) {
        String lower = e.getMessage() == null ? "" : e.getMessage().toLowerCase();
        return e.getErrorCode() == 19
                && lower.contains("loot_table_entries")
                && (lower.contains("primary key") || lower.contains("unique"));
    }

    private static boolean hasPositiveCost(Connection conn, long itemId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT cost_cp FROM items WHERE id = ?")) {
            ps.setLong(1, itemId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() && rs.getInt("cost_cp") > 0;
            }
        }
    }

    private static boolean isValidWeight(int weight) {
        return weight >= MIN_WEIGHT && weight <= MAX_WEIGHT;
    }
}
