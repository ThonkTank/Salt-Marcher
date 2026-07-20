package features.dungeon.api;

import org.jspecify.annotations.Nullable;
import features.dungeon.api.editor.DungeonEditorToolSelection;

public record DungeonEditorStateSnapshot(
        Selection selection,
        @Nullable DungeonInspectorSnapshot inspector,
        DungeonEditorPreview preview,
        String statusText,
        DungeonEditorViewMode viewMode,
        DungeonEditorToolSelection toolSelection,
        DungeonOverlaySettings overlaySettings,
        int projectionLevel
) {
    public DungeonEditorStateSnapshot {
        selection = selection == null ? Selection.empty() : selection;
        preview = preview == null ? DungeonEditorPreview.none() : preview;
        statusText = statusText == null ? "" : statusText;
        viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        toolSelection = toolSelection == null ? DungeonEditorToolSelection.select() : toolSelection;
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
    }

    public static DungeonEditorStateSnapshot empty(String statusText) {
        return new DungeonEditorStateSnapshot(
                Selection.empty(),
                null,
                DungeonEditorPreview.none(),
                statusText,
                DungeonEditorViewMode.GRID,
                DungeonEditorToolSelection.select(),
                DungeonOverlaySettings.defaults(),
                0);
    }

    public record Selection(
            DungeonTopologyElementRef topologyRef,
            long clusterId,
            boolean clusterSelection,
            @Nullable DungeonEditorHandleRef handleRef
    ) {
        public Selection {
            topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
            clusterId = Math.max(0L, clusterId);
        }

        public static Selection empty() {
            return new Selection(DungeonTopologyElementRef.empty(), 0L, false, null);
        }
    }
}
