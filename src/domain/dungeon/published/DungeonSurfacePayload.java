package src.domain.dungeon.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record DungeonSurfacePayload(
        String mapName,
        DungeonSurfaceKind surfaceKind,
        DungeonMapMode mode,
        int revision,
        DungeonMapSnapshot map,
        @Nullable DungeonMapSnapshot previewMap,
        List<String> aggregateSummaries,
        List<String> relationSummaries,
        @Nullable DungeonInspectorSnapshot inspector,
        @Nullable DungeonSurfaceTravel travel,
        DungeonSurfaceMessages messages
) {

    public DungeonSurfacePayload {
        mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName.trim();
        surfaceKind = surfaceKind == null ? DungeonSurfaceKind.defaultKind() : surfaceKind;
        mode = mode == null ? DungeonMapMode.defaultMode() : mode;
        revision = Math.max(0, revision);
        map = map == null ? DungeonMapSnapshot.empty() : map;
        aggregateSummaries = aggregateSummaries == null ? List.of() : List.copyOf(aggregateSummaries);
        relationSummaries = relationSummaries == null ? List.of() : List.copyOf(relationSummaries);
        messages = messages == null ? DungeonSurfaceMessages.empty() : messages;
    }

    public boolean hasPreviewMap() {
        return previewMap != null && !previewMap.equals(map);
    }
}
