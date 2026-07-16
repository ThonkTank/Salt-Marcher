package features.dungeon.api;

import org.jspecify.annotations.Nullable;

public record DungeonEditorStateSnapshot(
        Selection selection,
        @Nullable DungeonInspectorSnapshot inspector,
        DungeonEditorPreview preview,
        String statusText,
        DungeonEditorViewMode viewMode,
        DungeonEditorTool selectedTool,
        DungeonOverlaySettings overlaySettings,
        int projectionLevel
) {
    public DungeonEditorStateSnapshot {
        selection = selection == null ? Selection.empty() : selection;
        preview = preview == null ? DungeonEditorPreview.none() : preview;
        statusText = statusText == null ? "" : statusText;
        viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        selectedTool = selectedTool == null ? DungeonEditorTool.SELECT : selectedTool;
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
    }

    public static DungeonEditorStateSnapshot empty(String statusText) {
        return new DungeonEditorStateSnapshot(
                Selection.empty(),
                null,
                DungeonEditorPreview.none(),
                statusText,
                DungeonEditorViewMode.GRID,
                DungeonEditorTool.SELECT,
                DungeonOverlaySettings.defaults(),
                0);
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
