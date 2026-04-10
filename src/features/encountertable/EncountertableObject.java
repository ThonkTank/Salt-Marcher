package features.encountertable;

import database.DatabaseManager;
import features.creatures.catalog.CatalogObject;
import features.creatures.catalog.input.LoadCreaturesByIdsInput;
import features.encountertable.input.AddCreatureInput;
import features.encountertable.input.CreateTableInput;
import features.encountertable.input.DeleteTableInput;
import features.encountertable.input.LoadCandidatesInput;
import features.encountertable.input.LoadDistinctLinkedLootTableIdsInput;
import features.encountertable.input.LoadTableInput;
import features.encountertable.input.LoadTablesInput;
import features.encountertable.input.RemoveCreatureInput;
import features.encountertable.input.RenameTableInput;
import features.encountertable.input.UpdateLinkedLootTableInput;
import features.encountertable.model.EncounterTable;
import features.encountertable.repository.EncounterTableRepository;
import features.encountertable.service.EncounterTableNameNormalizer;
import features.encountertable.input.UpdateWeightInput;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Canonical root seam for encounter-table reads, mutations, and generator
 * candidate loading. Recovery remains owned by the dedicated recovery subtree.
 */
@SuppressWarnings("unused")
public final class EncountertableObject {
    private static final CatalogObject CREATURE_CATALOG = new CatalogObject();
    private static final Logger LOGGER = Logger.getLogger(EncountertableObject.class.getName());
    private static final int MIN_WEIGHT = 1;
    private static final int MAX_WEIGHT = 10;

    public LoadTablesInput.LoadedTablesInput loadTables(LoadTablesInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new LoadTablesInput.LoadedTablesInput(
                    true,
                    EncounterTableRepository.getAll(conn).stream()
                            .map(EncountertableObject::toSummary)
                            .toList());
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncountertableObject.loadTables(): DB access failed", e);
            return new LoadTablesInput.LoadedTablesInput(false, List.of());
        }
    }

    public LoadTableInput.LoadedTableInput loadTable(LoadTableInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            EncounterTable table = EncounterTableRepository.getWithEntries(conn, input.tableId());
            if (table == null) {
                return new LoadTableInput.LoadedTableInput(LoadTableInput.Status.NOT_FOUND, null);
            }
            return new LoadTableInput.LoadedTableInput(LoadTableInput.Status.SUCCESS, toTable(table));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncountertableObject.loadTable(): DB access failed", e);
            return new LoadTableInput.LoadedTableInput(LoadTableInput.Status.STORAGE_ERROR, null);
        }
    }

    public CreateTableInput.CreatedTableInput createTable(CreateTableInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            String normalizedName = EncounterTableNameNormalizer.normalizeForStorage(input.name());
            if (normalizedName.isBlank()) {
                return new CreateTableInput.CreatedTableInput(CreateTableInput.Status.VALIDATION_ERROR, -1L);
            }
            if (EncounterTableRepository.existsByNormalizedName(conn, normalizedName, null)) {
                return new CreateTableInput.CreatedTableInput(CreateTableInput.Status.DUPLICATE_NAME, -1L);
            }
            long tableId = EncounterTableRepository.create(conn, normalizedName, input.description());
            return new CreateTableInput.CreatedTableInput(CreateTableInput.Status.SUCCESS, tableId);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncountertableObject.createTable(): DB access failed", e);
            return new CreateTableInput.CreatedTableInput(
                    isDuplicateNameViolation(e) ? CreateTableInput.Status.DUPLICATE_NAME : CreateTableInput.Status.STORAGE_ERROR,
                    -1L);
        }
    }

    public RenameTableInput.RenamedTableInput renameTable(RenameTableInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            String normalizedName = EncounterTableNameNormalizer.normalizeForStorage(input.name());
            if (normalizedName.isBlank()) {
                return new RenameTableInput.RenamedTableInput(RenameTableInput.Status.VALIDATION_ERROR);
            }
            if (EncounterTableRepository.existsByNormalizedName(conn, normalizedName, input.tableId())) {
                return new RenameTableInput.RenamedTableInput(RenameTableInput.Status.DUPLICATE_NAME);
            }
            EncounterTableRepository.rename(conn, input.tableId(), normalizedName);
            return new RenameTableInput.RenamedTableInput(RenameTableInput.Status.SUCCESS);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncountertableObject.renameTable(): DB access failed", e);
            return new RenameTableInput.RenamedTableInput(
                    isDuplicateNameViolation(e) ? RenameTableInput.Status.DUPLICATE_NAME : RenameTableInput.Status.STORAGE_ERROR);
        }
    }

    public DeleteTableInput.DeletedTableInput deleteTable(DeleteTableInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            EncounterTableRepository.delete(conn, input.tableId());
            return new DeleteTableInput.DeletedTableInput(DeleteTableInput.Status.SUCCESS);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncountertableObject.deleteTable(): DB access failed", e);
            return new DeleteTableInput.DeletedTableInput(DeleteTableInput.Status.STORAGE_ERROR);
        }
    }

    public AddCreatureInput.AddedCreatureInput addCreature(AddCreatureInput input) {
        int weight = input.weight() == null ? 1 : input.weight();
        if (!isValidWeight(weight)) {
            return new AddCreatureInput.AddedCreatureInput(AddCreatureInput.Status.VALIDATION_ERROR);
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            EncounterTableRepository.addEntry(conn, input.tableId(), input.creatureId(), weight);
            return new AddCreatureInput.AddedCreatureInput(AddCreatureInput.Status.SUCCESS);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncountertableObject.addCreature(): DB access failed", e);
            return new AddCreatureInput.AddedCreatureInput(
                    isWeightConstraintViolation(e) ? AddCreatureInput.Status.VALIDATION_ERROR : AddCreatureInput.Status.STORAGE_ERROR);
        }
    }

    public RemoveCreatureInput.RemovedCreatureInput removeCreature(RemoveCreatureInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            EncounterTableRepository.removeEntry(conn, input.tableId(), input.creatureId());
            return new RemoveCreatureInput.RemovedCreatureInput(RemoveCreatureInput.Status.SUCCESS);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncountertableObject.removeCreature(): DB access failed", e);
            return new RemoveCreatureInput.RemovedCreatureInput(RemoveCreatureInput.Status.STORAGE_ERROR);
        }
    }

    public UpdateWeightInput.UpdatedWeightInput updateWeight(UpdateWeightInput input) {
        int weight = input.weight() == null ? 0 : input.weight();
        if (!isValidWeight(weight)) {
            return new UpdateWeightInput.UpdatedWeightInput(UpdateWeightInput.Status.VALIDATION_ERROR);
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            EncounterTableRepository.updateWeight(conn, input.tableId(), input.creatureId(), weight);
            return new UpdateWeightInput.UpdatedWeightInput(UpdateWeightInput.Status.SUCCESS);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncountertableObject.updateWeight(): DB access failed", e);
            return new UpdateWeightInput.UpdatedWeightInput(
                    isWeightConstraintViolation(e) ? UpdateWeightInput.Status.VALIDATION_ERROR : UpdateWeightInput.Status.STORAGE_ERROR);
        }
    }

    public UpdateLinkedLootTableInput.UpdatedLinkedLootTableInput updateLinkedLootTable(UpdateLinkedLootTableInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            EncounterTableRepository.updateLinkedLootTable(conn, input.tableId(), input.lootTableId());
            return new UpdateLinkedLootTableInput.UpdatedLinkedLootTableInput(UpdateLinkedLootTableInput.Status.SUCCESS);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncountertableObject.updateLinkedLootTable(): DB access failed", e);
            return new UpdateLinkedLootTableInput.UpdatedLinkedLootTableInput(UpdateLinkedLootTableInput.Status.STORAGE_ERROR);
        }
    }

    public LoadCandidatesInput.LoadedCandidatesInput loadCandidates(LoadCandidatesInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            EncounterTableRepository.GeneratorSelection selection =
                    EncounterTableRepository.getSelectionForGenerator(conn, input.tableIds(), input.maxXp());
            if (selection.weights().isEmpty()) {
                return new LoadCandidatesInput.LoadedCandidatesInput(
                        LoadCandidatesInput.Status.SUCCESS,
                        List.of(),
                        selection.weights());
            }
            LoadCreaturesByIdsInput.LoadedCreaturesByIdsInput creatureResult =
                    CREATURE_CATALOG.loadCreaturesByIds(
                            new LoadCreaturesByIdsInput(List.copyOf(selection.weights().keySet()), true));
            if (!creatureResult.success()) {
                return new LoadCandidatesInput.LoadedCandidatesInput(
                        LoadCandidatesInput.Status.STORAGE_ERROR,
                        List.of(),
                        Map.of());
            }
            return new LoadCandidatesInput.LoadedCandidatesInput(
                    LoadCandidatesInput.Status.SUCCESS,
                    creatureResult.creatures(),
                    selection.weights());
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncountertableObject.loadCandidates(): DB access failed", e);
            return new LoadCandidatesInput.LoadedCandidatesInput(
                    LoadCandidatesInput.Status.STORAGE_ERROR,
                    List.of(),
                    Map.of());
        }
    }

    public LoadDistinctLinkedLootTableIdsInput.LoadedDistinctLinkedLootTableIdsInput loadDistinctLinkedLootTableIds(
            LoadDistinctLinkedLootTableIdsInput input) {
        if (input.encounterTableIds() == null || input.encounterTableIds().isEmpty()) {
            return new LoadDistinctLinkedLootTableIdsInput.LoadedDistinctLinkedLootTableIdsInput(
                    LoadDistinctLinkedLootTableIdsInput.Status.SUCCESS,
                    List.of());
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return new LoadDistinctLinkedLootTableIdsInput.LoadedDistinctLinkedLootTableIdsInput(
                    LoadDistinctLinkedLootTableIdsInput.Status.SUCCESS,
                    EncounterTableRepository.getDistinctLinkedLootTableIds(conn, input.encounterTableIds()));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncountertableObject.loadDistinctLinkedLootTableIds(): DB access failed", e);
            return new LoadDistinctLinkedLootTableIdsInput.LoadedDistinctLinkedLootTableIdsInput(
                    LoadDistinctLinkedLootTableIdsInput.Status.STORAGE_ERROR,
                    List.of());
        }
    }

    private static LoadTablesInput.TableSummaryInput toSummary(EncounterTable table) {
        return new LoadTablesInput.TableSummaryInput(
                table.tableId,
                table.name,
                table.description,
                table.linkedLootTableId);
    }

    private static LoadTableInput.TableInput toTable(EncounterTable table) {
        return new LoadTableInput.TableInput(
                table.tableId,
                table.name,
                table.description,
                table.linkedLootTableId,
                table.entries == null ? List.of() : table.entries.stream().map(EncountertableObject::toEntry).toList());
    }

    private static LoadTableInput.EntryInput toEntry(EncounterTable.Entry entry) {
        return new LoadTableInput.EntryInput(
                entry.creatureId(),
                entry.creatureName(),
                entry.creatureType(),
                entry.crDisplay(),
                entry.xp(),
                entry.weight());
    }

    private static boolean isDuplicateNameViolation(SQLException e) {
        for (Throwable cause = e; cause != null; cause = cause.getCause()) {
            if (!(cause instanceof SQLException sql)) {
                continue;
            }
            if (sql.getErrorCode() != 19) {
                continue;
            }
            String message = sql.getMessage();
            if (message == null) {
                continue;
            }
            String lower = message.toLowerCase();
            if (lower.contains("idx_encounter_tables_name_norm_unique")
                    || (lower.contains("encounter_tables") && lower.contains("name"))) {
                return true;
            }
        }
        return false;
    }

    private static boolean isWeightConstraintViolation(SQLException e) {
        for (Throwable cause = e; cause != null; cause = cause.getCause()) {
            if (!(cause instanceof SQLException sql)) {
                continue;
            }
            if (sql.getErrorCode() != 19) {
                continue;
            }
            String message = sql.getMessage();
            if (message == null) {
                continue;
            }
            String lower = message.toLowerCase();
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
