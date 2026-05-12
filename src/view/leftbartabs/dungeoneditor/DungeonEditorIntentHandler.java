package src.view.leftbartabs.dungeoneditor;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.DungeonEditorApplicationService;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionCommand;
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

