package src.domain.dungeon.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record DungeonEditorSnapshot(
        List<DungeonMapSummary> maps,
        @Nullable DungeonMapId selectedMapId,
        String viewModeKey,
        String selectedTool,
        int projectionLevel,
        DungeonOverlaySettings overlaySettings,
        Selection selection,
        @Nullable DungeonSurfacePayload surface,
        DungeonEditorPreview preview,
        String statusText
) {

    public DungeonEditorSnapshot {
        maps = maps == null ? List.of() : List.copyOf(maps);
        viewModeKey = viewModeKey == null || viewModeKey.isBlank() ? "GRID" : viewModeKey;
        selectedTool = selectedTool == null || selectedTool.isBlank() ? "Auswahl" : selectedTool;
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
        selection = selection == null ? Selection.empty() : selection;
        preview = preview == null ? DungeonEditorPreview.none() : preview;
        statusText = statusText == null ? "" : statusText;
    }

    public static DungeonEditorSnapshot empty(String statusText) {
        return new DungeonEditorSnapshot(
                List.of(),
                null,
                "GRID",
                "Auswahl",
                0,
                DungeonOverlaySettings.defaults(),
                Selection.empty(),
                null,
                DungeonEditorPreview.none(),
                statusText);
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
