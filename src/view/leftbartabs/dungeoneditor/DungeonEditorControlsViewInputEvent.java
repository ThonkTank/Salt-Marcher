package src.view.leftbartabs.dungeoneditor;

import org.jspecify.annotations.Nullable;

public record DungeonEditorControlsViewInputEvent(
        MapSnapshot map,
        ToolSnapshot tool,
        ProjectionSnapshot projection,
        OverlaySnapshot overlay
) {

    public DungeonEditorControlsViewInputEvent(
            @Nullable MapSnapshot map,
            @Nullable ToolSnapshot tool,
            @Nullable ProjectionSnapshot projection,
            @Nullable OverlaySnapshot overlay
    ) {
        this.map = map == null ? new MapSnapshot(0L, null, false, false, false, false, false, false, false, false) : map;
        this.tool = tool == null ? new ToolSnapshot(null, null, null, false) : tool;
        this.projection = projection == null ? new ProjectionSnapshot(null, 0) : projection;
        this.overlay = overlay == null ? new OverlaySnapshot(null, 0, 0.0, null) : overlay;
    }

    public record MapSnapshot(
            long selectedMapIdValue,
            String editorDraftName,
            boolean editorInputObserved,
            boolean createControlActivated,
            boolean renameControlActivated,
            boolean deleteControlActivated,
            boolean dismissControlActivated,
            boolean submitControlActivated,
            boolean confirmDeleteControlActivated,
            boolean reloadControlActivated
    ) {
        public MapSnapshot {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            editorDraftName = editorDraftName == null ? "" : editorDraftName;
        }
    }

    public record ToolSnapshot(
            String requestedFamilyKey,
            String selectedToolKey,
            String selectedOptionKey,
            boolean dismissControlActivated
    ) {
        public ToolSnapshot(
                @Nullable String requestedFamilyKey,
                @Nullable String selectedToolKey,
                boolean dismissControlActivated
        ) {
            this(requestedFamilyKey, selectedToolKey, selectedToolKey, dismissControlActivated);
        }

        public ToolSnapshot(
                @Nullable String requestedFamilyKey,
                @Nullable String selectedToolKey,
                @Nullable String selectedOptionKey,
                boolean dismissControlActivated
        ) {
            this.requestedFamilyKey = requestedFamilyKey == null ? "" : requestedFamilyKey.strip();
            this.selectedToolKey = selectedToolKey == null ? "" : selectedToolKey.strip();
            this.selectedOptionKey = selectedOptionKey == null ? "" : selectedOptionKey.strip();
            this.dismissControlActivated = dismissControlActivated;
        }
    }

    public record ProjectionSnapshot(
            String viewModeKey,
            int levelShift
    ) {
        public ProjectionSnapshot(@Nullable String viewModeKey, int levelShift) {
            this.viewModeKey = viewModeKey == null ? "" : viewModeKey.strip();
            this.levelShift = levelShift;
        }
    }

    public record OverlaySnapshot(
            String modeKey,
            int levelRange,
            double opacity,
            String selectedLevelsText
    ) {
        public OverlaySnapshot(
                @Nullable String modeKey,
                int levelRange,
                double opacity,
                @Nullable String selectedLevelsText
        ) {
            this.modeKey = modeKey == null ? "" : modeKey;
            this.levelRange = Math.max(0, levelRange);
            this.opacity = Math.max(0.0, Math.min(1.0, opacity));
            this.selectedLevelsText = selectedLevelsText == null ? "" : selectedLevelsText.strip();
        }
    }
}
