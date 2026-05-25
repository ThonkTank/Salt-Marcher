package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;

final class DungeonEditorControlsProjectionServiceAssembly {

    private DungeonEditorControlsProjectionServiceAssembly() {
    }

    static src.domain.dungeon.published.DungeonEditorControlsSnapshot snapshot(
            src.domain.dungeon.model.worldspace.model.session.model.DungeonEditorSessionSnapshot.SnapshotData snapshot,
            DungeonEditorSurfaceContextServiceAssembly.SurfaceContext surfaceContext
    ) {
        return new src.domain.dungeon.published.DungeonEditorControlsSnapshot(
                publishedMapSummaries(snapshot.maps()),
                toPublishedMapId(snapshot.selectedMapId()),
                DungeonEditorValueProjectionServiceAssembly.viewMode(snapshot.viewMode()),
                DungeonEditorValueProjectionServiceAssembly.tool(snapshot.selectedTool()),
                snapshot.projectionLevel(),
                DungeonEditorValueProjectionServiceAssembly.overlay(snapshot.overlaySettings()),
                surfaceContext.reachableLevels(),
                surfaceContext.surfacePresent(),
                snapshot.statusText());
    }

    private static List<src.domain.dungeon.published.DungeonMapSummary> publishedMapSummaries(
            List<src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary> maps
    ) {
        List<src.domain.dungeon.published.DungeonMapSummary> result = new ArrayList<>();
        for (src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary map
                : maps == null ? List.<src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary>of() : maps) {
            result.add(toPublishedMapSummary(map));
        }
        return List.copyOf(result);
    }

    private static src.domain.dungeon.published.DungeonMapSummary toPublishedMapSummary(
            src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary map
    ) {
        src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary safeMap = map == null
                ? new src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary(
                        new src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.MapId(1L),
                        "Dungeon Map",
                        0L)
                : map;
        return new src.domain.dungeon.published.DungeonMapSummary(
                new src.domain.dungeon.published.DungeonMapId(safeMap.mapId().value()),
                safeMap.mapName(),
                safeMap.revision());
    }

    private static src.domain.dungeon.published.DungeonMapId toPublishedMapId(
            src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.MapId mapId
    ) {
        return mapId == null ? null : new src.domain.dungeon.published.DungeonMapId(mapId.value());
    }
}
