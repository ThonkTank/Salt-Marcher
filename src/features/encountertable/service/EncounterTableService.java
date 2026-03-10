package features.encountertable.service;

import database.DatabaseManager;
import features.creatures.api.CreatureCatalogService;
import features.creatures.model.Creature;
import features.encountertable.model.EncounterTable;
import features.encountertable.repository.EncounterTableRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Stateless facade for encounter table persistence.
 * Owns the Connection lifecycle via try-with-resources.
 */
public final class EncounterTableService {
    private static final Logger LOGGER = Logger.getLogger(EncounterTableService.class.getName());
    private static final int MIN_WEIGHT = 1;
    private static final int MAX_WEIGHT = 10;

    private EncounterTableService() {
        throw new AssertionError("No instances");
    }

    public enum ReadStatus {
        SUCCESS,
        NOT_FOUND,
        STORAGE_ERROR
    }

    public enum MutationStatus {
        SUCCESS,
        DUPLICATE_NAME,
        VALIDATION_ERROR,
        STORAGE_ERROR
    }

    public record CreateResult(MutationStatus status, long tableId) {}
    public record TableListResult(ReadStatus status, List<EncounterTable> tables) {}
    public record TableResult(ReadStatus status, EncounterTable table) {}
    public record CandidatesResult(ReadStatus status, List<Creature> candidates, Map<Long, Integer> selectionWeights) {}

    public static TableListResult loadAll() {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new TableListResult(ReadStatus.SUCCESS, EncounterTableRepository.getAll(conn));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncounterTableService.loadAll(): DB access failed", e);
            return new TableListResult(ReadStatus.STORAGE_ERROR, List.of());
        }
    }

    public static TableResult loadWithEntries(long tableId) {
        try (Connection conn = DatabaseManager.getConnection()) {
            EncounterTable table = EncounterTableRepository.getWithEntries(conn, tableId);
            if (table == null) return new TableResult(ReadStatus.NOT_FOUND, null);
            return new TableResult(ReadStatus.SUCCESS, table);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncounterTableService.loadWithEntries(): DB access failed", e);
            return new TableResult(ReadStatus.STORAGE_ERROR, null);
        }
    }

    /** Creates a new table and returns status + generated ID on success. */
    public static CreateResult createTable(String name, String description) {
        try (Connection conn = DatabaseManager.getConnection()) {
            String normalizedName = EncounterTableNameNormalizer.normalizeForStorage(name);
            if (normalizedName.isBlank()) {
                return new CreateResult(MutationStatus.VALIDATION_ERROR, -1);
            }
            if (EncounterTableRepository.existsByNormalizedName(conn, normalizedName, null)) {
                return new CreateResult(MutationStatus.DUPLICATE_NAME, -1);
            }
            long id = EncounterTableRepository.create(conn, normalizedName, description);
            return new CreateResult(MutationStatus.SUCCESS, id);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncounterTableService.createTable(): DB access failed", e);
            if (isDuplicateNameViolation(e)) return new CreateResult(MutationStatus.DUPLICATE_NAME, -1);
            return new CreateResult(MutationStatus.STORAGE_ERROR, -1);
        }
    }

    public static MutationStatus renameTable(long tableId, String name) {
        try (Connection conn = DatabaseManager.getConnection()) {
            String normalizedName = EncounterTableNameNormalizer.normalizeForStorage(name);
            if (normalizedName.isBlank()) {
                return MutationStatus.VALIDATION_ERROR;
            }
            if (EncounterTableRepository.existsByNormalizedName(conn, normalizedName, tableId)) {
                return MutationStatus.DUPLICATE_NAME;
            }
            EncounterTableRepository.rename(conn, tableId, normalizedName);
            return MutationStatus.SUCCESS;
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncounterTableService.renameTable(): DB access failed", e);
            if (isDuplicateNameViolation(e)) return MutationStatus.DUPLICATE_NAME;
            return MutationStatus.STORAGE_ERROR;
        }
    }

    public static MutationStatus deleteTable(long tableId) {
        try (Connection conn = DatabaseManager.getConnection()) {
            EncounterTableRepository.delete(conn, tableId);
            return MutationStatus.SUCCESS;
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncounterTableService.deleteTable(): DB access failed", e);
            return MutationStatus.STORAGE_ERROR;
        }
    }

    /** Adds a creature to a table with weight 1. No-op if already present. */
    public static MutationStatus addCreature(long tableId, long creatureId) {
        return addCreature(tableId, creatureId, 1);
    }

    /** Adds a creature to a table with the specified weight. No-op if already present. */
    public static MutationStatus addCreature(long tableId, long creatureId, int weight) {
        if (!isValidWeight(weight)) return MutationStatus.VALIDATION_ERROR;
        try (Connection conn = DatabaseManager.getConnection()) {
            EncounterTableRepository.addEntry(conn, tableId, creatureId, weight);
            return MutationStatus.SUCCESS;
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncounterTableService.addCreature(): DB access failed", e);
            if (isWeightConstraintViolation(e)) return MutationStatus.VALIDATION_ERROR;
            return MutationStatus.STORAGE_ERROR;
        }
    }

    public static MutationStatus removeCreature(long tableId, long creatureId) {
        try (Connection conn = DatabaseManager.getConnection()) {
            EncounterTableRepository.removeEntry(conn, tableId, creatureId);
            return MutationStatus.SUCCESS;
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncounterTableService.removeCreature(): DB access failed", e);
            return MutationStatus.STORAGE_ERROR;
        }
    }

    public static MutationStatus updateWeight(long tableId, long creatureId, int weight) {
        if (!isValidWeight(weight)) return MutationStatus.VALIDATION_ERROR;
        try (Connection conn = DatabaseManager.getConnection()) {
            EncounterTableRepository.updateWeight(conn, tableId, creatureId, weight);
            return MutationStatus.SUCCESS;
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncounterTableService.updateWeight(): DB access failed", e);
            if (isWeightConstraintViolation(e)) return MutationStatus.VALIDATION_ERROR;
            return MutationStatus.STORAGE_ERROR;
        }
    }

    /**
     * Returns unique creature candidates plus optional table selection weights for the encounter generator.
     * Only creatures with XP ≤ maxXp are included.
     */
    public static CandidatesResult getCandidatesFromTables(List<Long> tableIds, int maxXp) {
        try (Connection conn = DatabaseManager.getConnection()) {
            EncounterTableRepository.GeneratorSelection selection =
                    EncounterTableRepository.getSelectionForGenerator(conn, tableIds, maxXp);
            if (selection.weights().isEmpty()) {
                return new CandidatesResult(ReadStatus.SUCCESS, List.of(), selection.weights());
            }
            CreatureCatalogService.ServiceResult<List<Creature>> creatureResult =
                    CreatureCatalogService.loadCreaturesByIds(List.copyOf(selection.weights().keySet()));
            if (!creatureResult.isOk()) {
                return new CandidatesResult(ReadStatus.STORAGE_ERROR, List.of(), Map.of());
            }
            return new CandidatesResult(ReadStatus.SUCCESS, creatureResult.value(), selection.weights());
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncounterTableService.getCandidatesFromTables(): DB access failed", e);
            return new CandidatesResult(ReadStatus.STORAGE_ERROR, List.of(), Map.of());
        }
    }

    private static boolean isDuplicateNameViolation(SQLException e) {
        for (Throwable cause = e; cause != null; cause = cause.getCause()) {
            if (!(cause instanceof SQLException sql)) continue;
            if (sql.getErrorCode() != 19) continue;
            String msg = sql.getMessage();
            if (msg == null) continue;
            String lower = msg.toLowerCase();
            if (lower.contains("idx_encounter_tables_name_norm_unique")
                    || (lower.contains("encounter_tables") && lower.contains("name"))) {
                return true;
            }
        }
        return false;
    }

    private static boolean isWeightConstraintViolation(SQLException e) {
        for (Throwable cause = e; cause != null; cause = cause.getCause()) {
            if (!(cause instanceof SQLException sql)) continue;
            if (sql.getErrorCode() != 19) continue;
            String msg = sql.getMessage();
            if (msg == null) continue;
            String lower = msg.toLowerCase();
            if (lower.contains("check constraint failed")
                    && lower.contains("encounter_table_entries")
                    && lower.contains("weight")) {
                return true;
            }
        }
        return false;
    }

    private static boolean isValidWeight(int weight) {
        return weight >= MIN_WEIGHT && weight <= MAX_WEIGHT;
    }
}
