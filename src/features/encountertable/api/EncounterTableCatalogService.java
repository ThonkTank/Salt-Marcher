package features.encountertable.api;

import features.creatures.model.Creature;
import features.encountertable.model.EncounterTable;
import features.encountertable.service.EncounterTableService;

import java.util.List;
import java.util.Map;

/**
 * Cross-feature read facade for encounter table data needed outside the feature.
 */
public final class EncounterTableCatalogService {

    private EncounterTableCatalogService() {
        throw new AssertionError("No instances");
    }

    public enum ReadStatus {
        SUCCESS,
        STORAGE_ERROR
    }

    public record TableCatalogResult(ReadStatus status, List<EncounterTable> tables) {}
    public record CandidateSelectionResult(ReadStatus status, List<Creature> candidates, Map<Long, Integer> selectionWeights) {}

    public static TableCatalogResult loadAll() {
        EncounterTableService.TableListResult result = EncounterTableService.loadAll();
        return new TableCatalogResult(
                mapStatus(result.status()),
                result.tables());
    }

    public static CandidateSelectionResult loadCandidates(List<Long> tableIds, int maxXp) {
        EncounterTableService.CandidatesResult result = EncounterTableService.getCandidatesFromTables(tableIds, maxXp);
        return new CandidateSelectionResult(
                mapStatus(result.status()),
                result.candidates(),
                result.selectionWeights());
    }

    private static ReadStatus mapStatus(EncounterTableService.ReadStatus status) {
        return status == EncounterTableService.ReadStatus.SUCCESS
                ? ReadStatus.SUCCESS
                : ReadStatus.STORAGE_ERROR;
    }
}
