package src.domain.dungeoneditor.session.value;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonMapSummary;

public final class DungeonEditorSessionSnapshot {

    private DungeonEditorSessionSnapshot() {
    }

    public record SnapshotData(
            List<DungeonMapSummary> maps,
            @Nullable DungeonMapId selectedMapId,
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
            viewMode = viewMode == null ? DungeonEditorSessionValues.ViewMode.GRID : viewMode;
            selectedTool = selectedTool == null ? DungeonEditorSessionValues.Tool.SELECT : selectedTool;
            overlaySettings = overlaySettings == null ? DungeonEditorSessionValues.OverlaySettings.defaults() : overlaySettings;
            selection = selection == null ? DungeonEditorSessionValues.Selection.empty() : selection;
            preview = preview == null ? DungeonEditorSessionValues.Preview.none() : preview;
            statusText = statusText == null ? "" : statusText;
        }

        public static SnapshotData empty(String statusText) {
            return new SnapshotData(
                    List.of(),
                    null,
                    DungeonEditorSessionValues.ViewMode.GRID,
                    DungeonEditorSessionValues.Tool.SELECT,
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
            DungeonMapSnapshot map,
            @Nullable DungeonMapSnapshot previewMap,
            @Nullable DungeonInspectorSnapshot inspector
    ) {
        public SurfaceData {
            mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName;
            map = map == null ? DungeonMapSnapshot.empty() : map;
        }
    }
}
