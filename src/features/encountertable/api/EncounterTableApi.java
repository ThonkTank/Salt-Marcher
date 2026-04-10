package features.encountertable.api;

import features.encountertable.EncountertableObject;
import features.encountertable.input.LoadCandidatesInput;
import features.encountertable.input.LoadDistinctLinkedLootTableIdsInput;
import features.encountertable.input.LoadTablesInput;
import features.creatures.model.Creature;
import features.encountertable.model.EncounterTable;

import java.util.List;
import java.util.Map;

/**
 * Public cross-feature read facade for encounter table data.
 */
@SuppressWarnings("unused")
public final class EncounterTableApi {
    private static final EncountertableObject ENCOUNTER_TABLES = new EncountertableObject();

    private EncounterTableApi() {
        throw new AssertionError("No instances");
    }

    public enum ReadStatus {
        SUCCESS,
        STORAGE_ERROR
    }

    public record TableCatalogResult(ReadStatus status, List<EncounterTable> tables) {}
    public record EncounterTableSummary(long tableId, String name) {
        @Override
        public String toString() {
            return name != null ? name : "";
        }
    }
    public record TableSummaryCatalogResult(ReadStatus status, List<EncounterTableSummary> tables) {}
    public record CandidateSelectionResult(ReadStatus status, List<Creature> candidates, Map<Long, Integer> selectionWeights) {}
    public record LinkedLootTableIdsResult(ReadStatus status, List<Long> lootTableIds) {}

    public static TableCatalogResult loadAll() {
        LoadTablesInput.LoadedTablesInput result = ENCOUNTER_TABLES.loadTables(new LoadTablesInput());
        return new TableCatalogResult(
                mapStatus(result.success()),
                result.tables().stream()
                        .map(EncounterTableApi::toTable)
                        .toList());
    }

    public static TableSummaryCatalogResult loadAllSummaries() {
        LoadTablesInput.LoadedTablesInput result = ENCOUNTER_TABLES.loadTables(new LoadTablesInput());
        List<EncounterTableSummary> summaries = result.tables().stream()
                .map(table -> new EncounterTableSummary(table.tableId(), table.name()))
                .toList();
        return new TableSummaryCatalogResult(mapStatus(result.success()), summaries);
    }

    public static CandidateSelectionResult loadCandidates(List<Long> tableIds, int maxXp) {
        LoadCandidatesInput.LoadedCandidatesInput result =
                ENCOUNTER_TABLES.loadCandidates(new LoadCandidatesInput(tableIds, maxXp));
        return new CandidateSelectionResult(
                mapStatus(result.status()),
                result.candidates(),
                result.selectionWeights());
    }

    public static LinkedLootTableIdsResult loadDistinctLinkedLootTableIds(List<Long> tableIds) {
        LoadDistinctLinkedLootTableIdsInput.LoadedDistinctLinkedLootTableIdsInput result =
                ENCOUNTER_TABLES.loadDistinctLinkedLootTableIds(new LoadDistinctLinkedLootTableIdsInput(tableIds));
        return new LinkedLootTableIdsResult(mapStatus(result.status()), result.lootTableIds());
    }

    private static ReadStatus mapStatus(boolean success) {
        return success ? ReadStatus.SUCCESS : ReadStatus.STORAGE_ERROR;
    }

    private static ReadStatus mapStatus(LoadCandidatesInput.Status status) {
        return status == LoadCandidatesInput.Status.SUCCESS ? ReadStatus.SUCCESS : ReadStatus.STORAGE_ERROR;
    }

    private static ReadStatus mapStatus(LoadDistinctLinkedLootTableIdsInput.Status status) {
        return status == LoadDistinctLinkedLootTableIdsInput.Status.SUCCESS ? ReadStatus.SUCCESS : ReadStatus.STORAGE_ERROR;
    }

    private static EncounterTable toTable(LoadTablesInput.TableSummaryInput table) {
        EncounterTable mapped = new EncounterTable();
        mapped.tableId = table.tableId();
        mapped.name = table.name();
        mapped.description = table.description();
        mapped.linkedLootTableId = table.linkedLootTableId();
        mapped.entries = List.of();
        return mapped;
    }
}
