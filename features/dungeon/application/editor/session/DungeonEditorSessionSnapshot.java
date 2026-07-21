package features.dungeon.application.editor.session;

import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.api.DungeonEditorViewMode;
import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Inspector;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapId;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.api.editor.DungeonEditorToolSelection;

public final class DungeonEditorSessionSnapshot {

    private DungeonEditorSessionSnapshot() {
    }

    public static SnapshotData empty(String statusText) {
        return new SnapshotData(
                List.of(),
                null,
                DungeonEditorViewMode.GRID,
                DungeonEditorToolSelection.select(),
                0,
                DungeonOverlaySettings.defaults(),
                DungeonEditorSessionValues.Selection.empty(),
                null,
                DungeonEditorSessionValues.Preview.none(),
                statusText,
                DungeonEditorCommandOutcome.idle());
    }

    public record SnapshotData(
            List<DungeonEditorWorkspaceValues.MapSummary> maps,
            @Nullable MapId selectedMapId,
            DungeonEditorViewMode viewMode,
            DungeonEditorToolSelection toolSelection,
            int projectionLevel,
            DungeonOverlaySettings overlaySettings,
            DungeonEditorSessionValues.Selection selection,
            @Nullable SurfaceData surface,
            DungeonEditorSessionValues.Preview preview,
            String statusText,
            DungeonEditorCommandOutcome commandOutcome
    ) {
        public SnapshotData {
            maps = maps == null ? List.of() : List.copyOf(maps);
            viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
            toolSelection = toolSelection == null ? DungeonEditorToolSelection.select() : toolSelection;
            overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
            selection = selection == null ? DungeonEditorSessionValues.Selection.empty() : selection;
            preview = preview == null ? DungeonEditorSessionValues.Preview.none() : preview;
            statusText = statusText == null ? "" : statusText;
            commandOutcome = commandOutcome == null ? DungeonEditorCommandOutcome.idle() : commandOutcome;
        }

    }

    public record SurfaceData(
            DungeonEditorWorkspaceValues.@Nullable MapId mapId,
            long requestGeneration,
            long acceptedRevision,
            String mapName,
            int revision,
            MapSnapshot map,
            @Nullable MapSnapshot previewMap,
            @Nullable Inspector inspector
    ) {
        public SurfaceData {
            requestGeneration = Math.max(0L, requestGeneration);
            acceptedRevision = Math.max(0L, acceptedRevision);
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
                safeSession.statusText(),
                safeSession.commandOutcome());
    }

    public static ViewData viewData(@Nullable DungeonEditorSession session) {
        DungeonEditorSession safeSession = session == null ? DungeonEditorSession.empty() : session;
        return new ViewData(
                controlsData(safeSession),
                safeSession.selection(),
                safeSession.preview());
    }

    public record ControlsData(
            @Nullable MapId selectedMapId,
            DungeonEditorViewMode viewMode,
            DungeonEditorToolSelection toolSelection,
            int projectionLevel,
            DungeonOverlaySettings overlaySettings,
            String statusText,
            DungeonEditorCommandOutcome commandOutcome
    ) {
        public ControlsData {
            viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
            toolSelection = toolSelection == null ? DungeonEditorToolSelection.select() : toolSelection;
            overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
            statusText = statusText == null ? "" : statusText;
            commandOutcome = commandOutcome == null ? DungeonEditorCommandOutcome.idle() : commandOutcome;
        }

    }

    public record ViewData(
            ControlsData controlsData,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        public ViewData {
            controlsData = controlsData == null ? DungeonEditorSessionSnapshot.controlsData(null) : controlsData;
            selection = selection == null ? DungeonEditorSessionValues.Selection.empty() : selection;
            preview = preview == null ? DungeonEditorSessionValues.Preview.none() : preview;
        }

        public DungeonEditorViewMode viewMode() {
            return controlsData.viewMode();
        }

        public DungeonEditorToolSelection toolSelection() {
            return controlsData.toolSelection();
        }

        public int projectionLevel() {
            return controlsData.projectionLevel();
        }

        public DungeonOverlaySettings overlaySettings() {
            return controlsData.overlaySettings();
        }

        public String statusText() {
            return controlsData.statusText();
        }
    }
}
