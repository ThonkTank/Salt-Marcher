package src.domain.dungeon.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record DungeonEditorSnapshot(
        List<DungeonEditorMapSummary> maps,
        @Nullable DungeonEditorMapId selectedMapId,
        DungeonEditorViewMode viewMode,
        DungeonEditorTool selectedTool,
        int projectionLevel,
        DungeonEditorOverlaySettings overlaySettings,
        Selection selection,
        @Nullable DungeonEditorSurface surface,
        DungeonEditorPreview preview,
        @Nullable DungeonEditorMapProjectionSnapshot mapProjection,
        String statusText
) {

    public DungeonEditorSnapshot {
        maps = maps == null ? List.of() : List.copyOf(maps);
        viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        selectedTool = selectedTool == null ? DungeonEditorTool.SELECT : selectedTool;
        overlaySettings = overlaySettings == null ? DungeonEditorOverlaySettings.defaults() : overlaySettings;
        selection = selection == null ? Selection.empty() : selection;
        preview = preview == null ? DungeonEditorPreview.none() : preview;
        statusText = statusText == null ? "" : statusText;
    }

    public static DungeonEditorSnapshot empty(String statusText) {
        return new DungeonEditorSnapshot(
                List.of(),
                null,
                DungeonEditorViewMode.GRID,
                DungeonEditorTool.SELECT,
                0,
                DungeonEditorOverlaySettings.defaults(),
                Selection.empty(),
                null,
                DungeonEditorPreview.none(),
                null,
                statusText);
    }

    public record Selection(
            DungeonEditorTopologyElementRef topologyRef,
            long clusterId,
            boolean clusterSelection,
            @Nullable DungeonEditorHandleRef handleRef
    ) {

        public Selection {
            topologyRef = topologyRef == null ? DungeonEditorTopologyElementRef.empty() : topologyRef;
            clusterId = Math.max(0L, clusterId);
        }

        public static Selection empty() {
            return new Selection(DungeonEditorTopologyElementRef.empty(), 0L, false, null);
        }
    }
}
