package src.domain.dungeoneditor.model.workspace.helper;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;

final class DungeonEditorWorkspaceMapBoundaryTranslationHelper {

    private DungeonEditorWorkspaceMapBoundaryTranslationHelper() {
    }

    static DungeonEditorWorkspaceValues.@Nullable MapId toWorkspaceMapId(@Nullable DungeonMapId mapId) {
        return mapId == null ? null : new DungeonEditorWorkspaceValues.MapId(mapId.value());
    }

    static @Nullable DungeonMapId toDomainMapId(DungeonEditorWorkspaceValues.@Nullable MapId mapId) {
        return mapId == null ? null : new DungeonMapId(mapId.value());
    }

    static DungeonEditorWorkspaceValues.MapSummary toWorkspaceMapSummary(@Nullable DungeonMapSummary map) {
        return map == null
                ? new DungeonEditorWorkspaceValues.MapSummary(new DungeonEditorWorkspaceValues.MapId(1L), "Dungeon Map", 0L)
                : new DungeonEditorWorkspaceValues.MapSummary(
                        Objects.requireNonNull(toWorkspaceMapId(map.mapId())),
                        map.mapName(),
                        map.revision());
    }

    static DungeonEditorWorkspaceValues.MapSnapshot toWorkspaceMapSnapshot(@Nullable DungeonMapSnapshot map) {
        DungeonMapSnapshot safeMap = map == null ? DungeonMapSnapshot.empty() : map;
        return new DungeonEditorWorkspaceValues.MapSnapshot(
                DungeonEditorWorkspaceSnapshotBoundaryTranslationHelper.toWorkspaceTopology(safeMap.topology()),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(DungeonEditorWorkspaceSnapshotBoundaryTranslationHelper::toWorkspaceArea).toList(),
                safeMap.boundaries().stream().map(DungeonEditorWorkspaceSnapshotBoundaryTranslationHelper::toWorkspaceBoundary).toList(),
                safeMap.features().stream().map(DungeonEditorWorkspaceSnapshotBoundaryTranslationHelper::toWorkspaceFeature).toList(),
                safeMap.editorHandles().stream().map(DungeonEditorWorkspaceSnapshotBoundaryTranslationHelper::toWorkspaceHandle).toList());
    }

    static DungeonEditorWorkspaceValues.@Nullable MapSnapshot toWorkspacePreviewMap(@Nullable DungeonSnapshot snapshot) {
        return snapshot == null ? null : toWorkspaceMapSnapshot(snapshot.map());
    }
}
