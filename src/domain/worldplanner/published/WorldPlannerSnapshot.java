package src.domain.worldplanner.published;

import java.util.List;

public record WorldPlannerSnapshot(
        WorldPlannerReadStatus status,
        List<WorldNpcSummary> npcs,
        List<WorldFactionSummary> factions,
        List<WorldLocationSummary> locations,
        String statusText
) {

    public WorldPlannerSnapshot {
        status = WorldPlannerReadStatus.normalize(status);
        npcs = npcs == null ? List.of() : List.copyOf(npcs);
        factions = factions == null ? List.of() : List.copyOf(factions);
        locations = locations == null ? List.of() : List.copyOf(locations);
        statusText = statusText == null ? "" : statusText;
    }
}
