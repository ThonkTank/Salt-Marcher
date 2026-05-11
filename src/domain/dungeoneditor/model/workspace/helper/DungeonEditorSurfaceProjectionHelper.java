package src.domain.dungeoneditor.model.workspace.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorMapId;
import src.domain.dungeoneditor.published.DungeonEditorMapSummary;
import src.domain.dungeoneditor.published.DungeonEditorSurface;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorSurfaceProjectionHelper {

    private DungeonEditorSurfaceProjectionHelper() {
    }

    public static DungeonEditorMapSummary toPublishedMapSummary(DungeonEditorWorkspaceValues.@Nullable MapSummary map) {
        DungeonEditorWorkspaceValues.MapSummary safeMap = map == null
                ? new DungeonEditorWorkspaceValues.MapSummary(new DungeonEditorWorkspaceValues.MapId(1L), "Dungeon Map", 0L)
                : map;
        return new DungeonEditorMapSummary(
                new DungeonEditorMapId(safeMap.mapId().value()),
                safeMap.mapName(),
                safeMap.revision());
    }

    public static @Nullable DungeonEditorMapId toPublishedMapId(DungeonEditorWorkspaceValues.@Nullable MapId mapId) {
        return mapId == null ? null : new DungeonEditorMapId(mapId.value());
    }

    public static @Nullable DungeonEditorSurface toPublishedSurface(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface
    ) {
        if (surface == null) {
            return null;
        }
        return new DungeonEditorSurface(
                surface.mapName(),
                surface.revision(),
                DungeonEditorMapSnapshotProjectionHelper.toPublishedMap(surface.map()),
                surface.previewMap() == null ? null : DungeonEditorMapSnapshotProjectionHelper.toPublishedMap(surface.previewMap()),
                DungeonEditorInspectorProjectionHelper.toPublishedInspector(surface.inspector()));
    }
}
