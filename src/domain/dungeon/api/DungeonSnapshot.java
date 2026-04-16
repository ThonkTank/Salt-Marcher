package src.domain.dungeon.api;

import src.domain.mapcore.api.MapSurfaceSnapshot;

import java.util.List;

/**
 * Immutable dungeon snapshot shared by editor and travel views.
 */
public record DungeonSnapshot(
        String mapName,
        DungeonMapMode mode,
        MapSurfaceSnapshot surface,
        List<String> aggregateSummaries,
        List<String> relationSummaries,
        int revision
) {

    public DungeonSnapshot {
        mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName;
        mode = mode == null ? DungeonMapMode.EDITOR : mode;
        surface = surface == null ? MapSurfaceSnapshot.empty() : surface;
        aggregateSummaries = aggregateSummaries == null ? List.of() : List.copyOf(aggregateSummaries);
        relationSummaries = relationSummaries == null ? List.of() : List.copyOf(relationSummaries);
        revision = Math.max(0, revision);
    }

    public DungeonSnapshot withMode(DungeonMapMode nextMode) {
        return new DungeonSnapshot(mapName, nextMode, surface, aggregateSummaries, relationSummaries, revision);
    }
}
