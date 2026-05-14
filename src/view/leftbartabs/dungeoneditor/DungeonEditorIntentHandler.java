package src.view.leftbartabs.dungeoneditor;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonEditorApplicationService;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionCommand;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.view.slotcontent.main.dungeonmap.DungeonMapViewInputEvent;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel;

final class DungeonEditorIntentHandler {

    private final DungeonEditorContributionModel presentationModel;
    private final MapCanvasContentModel mapCanvasContentModel;
    private final DungeonEditorApplicationService editor;

    DungeonEditorIntentHandler(
            DungeonEditorContributionModel presentationModel,
            MapCanvasContentModel mapCanvasContentModel,
            DungeonEditorApplicationService editor
    ) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.mapCanvasContentModel = Objects.requireNonNull(mapCanvasContentModel, "mapCanvasContentModel");
        this.editor = Objects.requireNonNull(editor, "editor");
    }

    void consume(DungeonMapViewInputEvent event) {
        if (event == null) {
            return;
        }
        apply(MainViewIntent.toCommand(mapCanvasContentModel, event.canvasEvent()));
    }

    void consume(DungeonEditorControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        ControlsIntent.consume(presentationModel, this::apply, event);
    }

    void consume(DungeonEditorStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        apply(StateSaveIntent.toSaveCommand(presentationModel, event));
    }

    private void apply(@Nullable DungeonEditorSessionCommand command) {
        if (command != null) {
            editor.applyEditorSession(command);
        }
    }

}

final class Commands {

    private Commands() {
    }

    static DungeonEditorSessionCommand mainViewCommand(DungeonEditorSessionCommand.MainViewInput mainViewInput) {
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.INTERPRET_MAIN_VIEW,
                null,
                "",
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                DungeonEditorSessionValues.Tool.defaultTool(),
                0,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                mainViewInput,
                DungeonEditorSessionCommand.RoomNarrationInput.empty());
    }

    static DungeonEditorSessionCommand mapCommand(
            DungeonEditorSessionCommand.Action action,
            DungeonEditorWorkspaceValues.MapId mapId,
            String mapName
    ) {
        return new DungeonEditorSessionCommand(
                action,
                mapId,
                mapName,
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                DungeonEditorSessionValues.Tool.defaultTool(),
                0,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                DungeonEditorSessionCommand.MainViewInput.empty(),
                DungeonEditorSessionCommand.RoomNarrationInput.empty());
    }

    static DungeonEditorSessionCommand viewModeCommand(DungeonEditorSessionValues.ViewMode viewMode) {
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.SET_VIEW_MODE,
                null,
                "",
                viewMode,
                DungeonEditorSessionValues.Tool.defaultTool(),
                0,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                DungeonEditorSessionCommand.MainViewInput.empty(),
                DungeonEditorSessionCommand.RoomNarrationInput.empty());
    }

    static DungeonEditorSessionCommand toolCommand(DungeonEditorSessionValues.Tool tool) {
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.SET_TOOL,
                null,
                "",
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                tool,
                0,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                DungeonEditorSessionCommand.MainViewInput.empty(),
                DungeonEditorSessionCommand.RoomNarrationInput.empty());
    }

    static DungeonEditorSessionCommand shiftProjectionLevelCommand(int projectionLevelDelta) {
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.SHIFT_PROJECTION_LEVEL,
                null,
                "",
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                DungeonEditorSessionValues.Tool.defaultTool(),
                projectionLevelDelta,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                DungeonEditorSessionCommand.MainViewInput.empty(),
                DungeonEditorSessionCommand.RoomNarrationInput.empty());
    }

    static DungeonEditorSessionCommand overlayCommand(
            DungeonEditorSessionValues.OverlaySettings overlaySettings
    ) {
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.SET_OVERLAY,
                null,
                "",
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                DungeonEditorSessionValues.Tool.defaultTool(),
                0,
                overlaySettings,
                DungeonEditorSessionCommand.MainViewInput.empty(),
                DungeonEditorSessionCommand.RoomNarrationInput.empty());
    }

    static DungeonEditorSessionCommand roomNarrationCommand(
            DungeonEditorSessionCommand.RoomNarrationInput roomNarration
    ) {
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.SAVE_ROOM_NARRATION,
                null,
                "",
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                DungeonEditorSessionValues.Tool.defaultTool(),
                0,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                DungeonEditorSessionCommand.MainViewInput.empty(),
                roomNarration);
    }
}
