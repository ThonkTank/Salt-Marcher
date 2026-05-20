package src.domain.dungeon.model.editor.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonEditorSurface;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorSurfaceProjectionHelper {

    private DungeonEditorSurfaceProjectionHelper() {
    }

    public static DungeonMapSummary toPublishedMapSummary(DungeonEditorWorkspaceValues.@Nullable MapSummary map) {
        DungeonEditorWorkspaceValues.MapSummary safeMap = map == null
                ? new DungeonEditorWorkspaceValues.MapSummary(new DungeonEditorWorkspaceValues.MapId(1L), "Dungeon Map", 0L)
                : map;
        return new DungeonMapSummary(
                new DungeonMapId(safeMap.mapId().value()),
                safeMap.mapName(),
                safeMap.revision());
    }

    public static @Nullable DungeonMapId toPublishedMapId(DungeonEditorWorkspaceValues.@Nullable MapId mapId) {
        return mapId == null ? null : new DungeonMapId(mapId.value());
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
