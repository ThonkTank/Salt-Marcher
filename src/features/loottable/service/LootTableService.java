package features.loottable.service;

import database.DatabaseManager;
import features.loottable.model.LootTable;
import features.loottable.repository.LootTableRepository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

public final class LootTableService {
    private static final Logger LOGGER = Logger.getLogger(LootTableService.class.getName());
    private static final int MIN_WEIGHT = 1;
    private static final int MAX_WEIGHT = 10;

    private LootTableService() {
        throw new AssertionError("No instances");
    }

    public enum ReadStatus { SUCCESS, NOT_FOUND, STORAGE_ERROR }
    public enum MutationStatus { SUCCESS, DUPLICATE_NAME, DUPLICATE_ENTRY, VALIDATION_ERROR, STORAGE_ERROR }

    public record TableListResult(ReadStatus status, List<LootTable> tables) {}
    public record TableResult(ReadStatus status, LootTable table) {}
    public record CreateResult(MutationStatus status, long tableId) {}
    public record WeightedItemsResult(ReadStatus status, List<LootTable.Entry> items) {}

    public static TableListResult loadAll() {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new TableListResult(ReadStatus.SUCCESS, LootTableRepository.getAll(conn));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "LootTableService.loadAll(): DB access failed", e);
            return new TableListResult(ReadStatus.STORAGE_ERROR, List.of());
        }
    }

    public static TableResult loadWithEntries(long tableId) {
        try (Connection conn = DatabaseManager.getConnection()) {
            LootTable table = LootTableRepository.getWithEntries(conn, tableId);
            if (table == null) {
                return new TableResult(ReadStatus.NOT_FOUND, null);
            }
            return new TableResult(ReadStatus.SUCCESS, table);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "LootTableService.loadWithEntries(): DB access failed", e);
            return new TableResult(ReadStatus.STORAGE_ERROR, null);
        }
    }

    public static CreateResult createTable(String name, String description) {
        try (Connection conn = DatabaseManager.getConnection()) {
            String normalizedName = LootTableNameNormalizer.normalizeForStorage(name);
            if (normalizedName.isBlank()) {
                return new CreateResult(MutationStatus.VALIDATION_ERROR, -1);
            }
            if (LootTableRepository.existsByNormalizedName(conn, normalizedName, null)) {
                return new CreateResult(MutationStatus.DUPLICATE_NAME, -1);
            }
            long id = LootTableRepository.create(conn, normalizedName, description);
            return new CreateResult(MutationStatus.SUCCESS, id);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "LootTableService.createTable(): DB access failed", e);
            return new CreateResult(isDuplicateNameViolation(e) ? MutationStatus.DUPLICATE_NAME : MutationStatus.STORAGE_ERROR, -1);
        }
    }

    public static MutationStatus renameTable(long tableId, String name) {
        try (Connection conn = DatabaseManager.getConnection()) {
            String normalizedName = LootTableNameNormalizer.normalizeForStorage(name);
            if (normalizedName.isBlank()) {
                return MutationStatus.VALIDATION_ERROR;
            }
            if (LootTableRepository.existsByNormalizedName(conn, normalizedName, tableId)) {
                return MutationStatus.DUPLICATE_NAME;
            }
            LootTableRepository.rename(conn, tableId, normalizedName);
            return MutationStatus.SUCCESS;
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "LootTableService.renameTable(): DB access failed", e);
            return isDuplicateNameViolation(e) ? MutationStatus.DUPLICATE_NAME : MutationStatus.STORAGE_ERROR;
        }
    }

    public static MutationStatus deleteTable(long tableId) {
        try (Connection conn = DatabaseManager.getConnection()) {
            LootTableRepository.delete(conn, tableId);
            return MutationStatus.SUCCESS;
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "LootTableService.deleteTable(): DB access failed", e);
            return MutationStatus.STORAGE_ERROR;
        }
    }

    public static MutationStatus addItem(long tableId, long itemId) {
        return addItem(tableId, itemId, 1);
    }

    public static MutationStatus addItem(long tableId, long itemId, int weight) {
        if (!isValidWeight(weight)) return MutationStatus.VALIDATION_ERROR;
        if (itemId <= 0) return MutationStatus.VALIDATION_ERROR;
        try (Connection conn = DatabaseManager.getConnection()) {
            if (!hasPositiveCost(conn, itemId)) {
                return MutationStatus.VALIDATION_ERROR;
            }
            LootTableRepository.addEntry(conn, tableId, itemId, weight);
            return MutationStatus.SUCCESS;
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "LootTableService.addItem(): DB access failed", e);
            if (isDuplicateEntryViolation(e)) return MutationStatus.DUPLICATE_ENTRY;
            return isWeightConstraintViolation(e) ? MutationStatus.VALIDATION_ERROR : MutationStatus.STORAGE_ERROR;
        }
    }

    public static MutationStatus removeItem(long tableId, long itemId) {
        try (Connection conn = DatabaseManager.getConnection()) {
            LootTableRepository.removeEntry(conn, tableId, itemId);
            return MutationStatus.SUCCESS;
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "LootTableService.removeItem(): DB access failed", e);
            return MutationStatus.STORAGE_ERROR;
        }
    }

    public static MutationStatus updateWeight(long tableId, long itemId, int weight) {
        if (!isValidWeight(weight)) return MutationStatus.VALIDATION_ERROR;
        try (Connection conn = DatabaseManager.getConnection()) {
            LootTableRepository.updateWeight(conn, tableId, itemId, weight);
            return MutationStatus.SUCCESS;
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "LootTableService.updateWeight(): DB access failed", e);
            return isWeightConstraintViolation(e) ? MutationStatus.VALIDATION_ERROR : MutationStatus.STORAGE_ERROR;
        }
    }

    public static WeightedItemsResult loadWeightedItems(long lootTableId) {
        try (Connection conn = DatabaseManager.getConnection()) {
            List<LootTable.Entry> items = LootTableRepository.getWeightedItems(conn, lootTableId);
            return new WeightedItemsResult(ReadStatus.SUCCESS, items);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "LootTableService.loadWeightedItems(): DB access failed", e);
            return new WeightedItemsResult(ReadStatus.STORAGE_ERROR, List.of());
        }
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
