package features.dungeon.application.editor.session;

import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Inspector;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapId;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.api.editor.DungeonEditorToolSelection;

public final class DungeonEditorSessionSnapshot {

    private DungeonEditorSessionSnapshot() {
    }

    public static SnapshotData empty(String statusText) {
        return new SnapshotData(
                List.of(),
                null,
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                DungeonEditorToolSelection.select(),
                0,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                DungeonEditorSessionValues.Selection.empty(),
                null,
                DungeonEditorSessionValues.Preview.none(),
                statusText);
    }

    public record SnapshotData(
            List<DungeonEditorWorkspaceValues.MapSummary> maps,
            @Nullable MapId selectedMapId,
            DungeonEditorSessionValues.ViewMode viewMode,
            DungeonEditorToolSelection toolSelection,
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
            toolSelection = toolSelection == null ? DungeonEditorToolSelection.select() : toolSelection;
            overlaySettings = overlaySettings == null ? DungeonEditorSessionValues.OverlaySettings.defaults() : overlaySettings;
            selection = selection == null ? DungeonEditorSessionValues.Selection.empty() : selection;
            preview = preview == null ? DungeonEditorSessionValues.Preview.none() : preview;
            statusText = statusText == null ? "" : statusText;
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

    public static ControlsData controlsData(@Nullable DungeonEditorSession session) {
        DungeonEditorSession safeSession = session == null ? DungeonEditorSession.empty() : session;
        return new ControlsData(
                safeSession.selectedMapId(),
                safeSession.viewMode(),
                safeSession.toolSelection(),
                safeSession.projectionLevel(),
                safeSession.overlaySettings(),
                safeSession.statusText());
    }

    public static SessionFrameData sessionFrameData(@Nullable DungeonEditorSession session) {
        DungeonEditorSession safeSession = session == null ? DungeonEditorSession.empty() : session;
        return new SessionFrameData(
                controlsData(safeSession),
                safeSession.selection(),
                safeSession.preview());
    }

    public record ControlsData(
            @Nullable MapId selectedMapId,
            DungeonEditorSessionValues.ViewMode viewMode,
            DungeonEditorToolSelection toolSelection,
            int projectionLevel,
            DungeonEditorSessionValues.OverlaySettings overlaySettings,
            String statusText
    ) {
        public ControlsData {
            viewMode = viewMode == null ? DungeonEditorSessionValues.ViewMode.defaultMode() : viewMode;
            toolSelection = toolSelection == null ? DungeonEditorToolSelection.select() : toolSelection;
            overlaySettings = overlaySettings == null ? DungeonEditorSessionValues.OverlaySettings.defaults() : overlaySettings;
            statusText = statusText == null ? "" : statusText;
        }

    }

    public record SessionFrameData(
            ControlsData controlsData,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        public SessionFrameData {
            controlsData = controlsData == null ? DungeonEditorSessionSnapshot.controlsData(null) : controlsData;
            selection = selection == null ? DungeonEditorSessionValues.Selection.empty() : selection;
            preview = preview == null ? DungeonEditorSessionValues.Preview.none() : preview;
        }

        public DungeonEditorSessionValues.ViewMode viewMode() {
            return controlsData.viewMode();
        }

        public DungeonEditorToolSelection toolSelection() {
            return controlsData.toolSelection();
        }

        public int projectionLevel() {
            return controlsData.projectionLevel();
        }

        public DungeonEditorSessionValues.OverlaySettings overlaySettings() {
            return controlsData.overlaySettings();
        }

        public String statusText() {
            return controlsData.statusText();
        }
    }
}
