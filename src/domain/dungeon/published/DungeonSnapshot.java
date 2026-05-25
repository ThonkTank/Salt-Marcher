package src.domain.dungeon.published;

import java.util.List;

/**
 * Immutable dungeon snapshot shared by editor and travel views.
 */
public record DungeonSnapshot(
        String mapName,
        DungeonMapMode mode,
        DungeonMapSnapshot map,
        List<String> aggregateSummaries,
        List<String> relationSummaries,
        int revision
) {

    public DungeonSnapshot {
        mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName;
        mode = mode == null ? DungeonMapMode.defaultMode() : mode;
        map = map == null ? DungeonMapSnapshot.empty() : map;
        aggregateSummaries = aggregateSummaries == null ? List.of() : List.copyOf(aggregateSummaries);
        relationSummaries = relationSummaries == null ? List.of() : List.copyOf(relationSummaries);
        revision = Math.max(0, revision);
    }

}
