package features.dungeon.api.editor;

import features.dungeon.api.DungeonEditorPreview;
import features.dungeon.api.DungeonEditorStateSnapshot;
import features.dungeon.api.DungeonEditorSurface;
import features.dungeon.api.DungeonEditorTool;
import features.dungeon.api.DungeonEditorViewMode;
import features.dungeon.api.DungeonInspectorSnapshot;
import features.dungeon.api.DungeonMapId;
import features.dungeon.api.DungeonMapSummary;
import features.dungeon.api.DungeonOverlaySettings;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** One immutable publication supplying every current Dungeon Editor consumer. */
public record DungeonEditorState(
        long publicationRevision,
        long requestGeneration,
        List<DungeonMapSummary> catalog,
        @Nullable DungeonMapId selectedMapId,
        @Nullable DungeonEditorSurface selectedWindow,
        DungeonEditorViewMode viewMode,
        DungeonEditorTool selectedTool,
        DungeonEditorToolSelection toolSelection,
        DungeonOverlaySettings overlaySettings,
        int projectionLevel,
        List<Integer> reachableLevels,
        DungeonEditorStateSnapshot.Selection selection,
        DungeonEditorDraftState draft,
        DungeonEditorPreview preview,
        @Nullable DungeonInspectorSnapshot inspector,
        CommandStatus commandStatus
) {
    public DungeonEditorState {
        publicationRevision = Math.max(0L, publicationRevision);
        requestGeneration = Math.max(0L, requestGeneration);
        catalog = catalog == null ? List.of() : List.copyOf(catalog);
        viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        selectedTool = selectedTool == null ? DungeonEditorTool.SELECT : selectedTool;
        toolSelection = toolSelection == null ? DungeonEditorToolSelection.select() : toolSelection;
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
        reachableLevels = reachableLevels == null ? List.of(0) : List.copyOf(reachableLevels);
        selection = selection == null ? DungeonEditorStateSnapshot.Selection.empty() : selection;
        draft = draft == null ? DungeonEditorDraftState.empty() : draft;
        preview = preview == null ? DungeonEditorPreview.none() : preview;
        commandStatus = commandStatus == null ? CommandStatus.idle() : commandStatus;
    }

    public static DungeonEditorState empty() {
        return new DungeonEditorState(
                0L,
                0L,
                List.of(),
                null,
                null,
                DungeonEditorViewMode.GRID,
                DungeonEditorTool.SELECT,
                DungeonEditorToolSelection.select(),
                DungeonOverlaySettings.defaults(),
                0,
                List.of(0),
                DungeonEditorStateSnapshot.Selection.empty(),
                DungeonEditorDraftState.empty(),
                DungeonEditorPreview.none(),
                null,
                CommandStatus.idle());
    }

    public record CommandStatus(boolean busy, String message) {
        public CommandStatus {
            message = message == null ? "" : message;
        }

        public static CommandStatus idle() {
            return new CommandStatus(false, "");
        }
    }
}
