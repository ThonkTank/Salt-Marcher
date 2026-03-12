package features.world.dungeonmap.service.adapter;

import features.encounter.api.EncounterStorageApi;
import features.world.dungeonmap.api.DungeonEncounterSummary;

import java.util.List;

/**
 * Dungeon-scoped adapter around persisted encounter summaries used by feature editing.
 */
public final class DungeonEncounterCatalogAdapter {

    private DungeonEncounterCatalogAdapter() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonEncounterSummary> loadSummaries() {
        EncounterStorageApi.EncounterSummaryCatalogResult result = EncounterStorageApi.loadAllSummaries();
        if (result.status() != EncounterStorageApi.ReadStatus.SUCCESS) {
            throw new IllegalStateException("EncounterStorageApi.loadAllSummaries failed");
        }
        return result.encounters().stream()
                .map(encounter -> new DungeonEncounterSummary(
                        encounter.encounterId(),
                        encounter.name(),
                        encounter.difficulty(),
                        encounter.shapeLabel(),
                        encounter.slotCount()))
                .toList();
    }
}
