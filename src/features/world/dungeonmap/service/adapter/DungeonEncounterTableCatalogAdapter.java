package features.world.dungeonmap.service.adapter;

import features.encountertable.api.EncounterTableApi;
import features.world.dungeonmap.model.DungeonEncounterTableSummary;

import java.util.List;

/**
 * Dungeon-scoped adapter around encounter-table summaries used by area editing.
 */
public final class DungeonEncounterTableCatalogAdapter {

    private DungeonEncounterTableCatalogAdapter() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonEncounterTableSummary> loadSummaries() {
        EncounterTableApi.TableSummaryCatalogResult result = EncounterTableApi.loadAllSummaries();
        if (result.status() != EncounterTableApi.ReadStatus.SUCCESS) {
            throw new IllegalStateException("EncounterTableApi.loadAllSummaries failed");
        }
        return result.tables().stream()
                .map(table -> new DungeonEncounterTableSummary(table.tableId(), table.name()))
                .toList();
    }
}
