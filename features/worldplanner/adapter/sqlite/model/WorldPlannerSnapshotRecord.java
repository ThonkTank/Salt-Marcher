package features.worldplanner.adapter.sqlite.model;

import java.util.List;

public record WorldPlannerSnapshotRecord(
        List<WorldNpcRecord> npcs,
        List<WorldFactionRecord> factions,
        List<WorldLocationRecord> locations
) {

    public WorldPlannerSnapshotRecord {
        npcs = npcs == null ? List.of() : List.copyOf(npcs);
        factions = factions == null ? List.of() : List.copyOf(factions);
        locations = locations == null ? List.of() : List.copyOf(locations);
    }
}
