package src.domain.dungeoneditor.session.value;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.Inspector;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.MapSnapshot;

public final class DungeonEditorSessionSnapshot {

    private DungeonEditorSessionSnapshot() {
    }

    public static SnapshotData emptySnapshot(String statusText) {
        return SnapshotData.empty(statusText);
    }

    public record SnapshotData(
            List<DungeonEditorWorkspaceValues.MapSummary> maps,
            @Nullable MapId selectedMapId,
            DungeonEditorSessionValues.ViewMode viewMode,
            DungeonEditorSessionValues.Tool selectedTool,
            int projectionLevel,
            DungeonEditorSessionValues.OverlaySettings overlaySettings,
            DungeonEditorSessionValues.Selection selection,
            @Nullable SurfaceData surface,
            DungeonEditorSessionValues.Preview preview,
            String statusText
    ) {
        public SnapshotData {
            maps = maps == null ? List.of() : List.copyOf(maps);
            viewMode = viewMode == null ? DungeonEditorSessionValues.ViewMode.defaultMode() : viewMode;
            selectedTool = selectedTool == null ? DungeonEditorSessionValues.Tool.defaultTool() : selectedTool;
            overlaySettings = overlaySettings == null ? DungeonEditorSessionValues.OverlaySettings.defaults() : overlaySettings;
            selection = selection == null ? DungeonEditorSessionValues.Selection.empty() : selection;
            preview = preview == null ? DungeonEditorSessionValues.Preview.none() : preview;
            statusText = statusText == null ? "" : statusText;
        }

        public static SnapshotData empty(String statusText) {
            return new SnapshotData(
                    List.of(),
                    null,
                    DungeonEditorSessionValues.ViewMode.defaultMode(),
                    DungeonEditorSessionValues.Tool.defaultTool(),
                    0,
                    DungeonEditorSessionValues.OverlaySettings.defaults(),
                    DungeonEditorSessionValues.Selection.empty(),
                    null,
                    DungeonEditorSessionValues.Preview.none(),
                    statusText);
        }
    }

    public record SurfaceData(
            String mapName,
            int revision,
            MapSnapshot map,
            @Nullable MapSnapshot previewMap,
            @Nullable Inspector inspector
    ) {
        public SurfaceData {
            mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName;
            map = map == null ? DungeonEditorWorkspaceValues.MapSnapshot.empty() : map;
        }
    }
}
