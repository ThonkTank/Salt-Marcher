package features.world.dungeonmap.editor.workspace.ui.base.input;

import features.world.dungeonmap.editor.workspace.ui.base.AbstractDungeonPane;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorSurface;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonPaneInteractionSink;
import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorEditInteractionController;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPanePreviewModel;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPaneRenderState;
import features.world.dungeonmap.editor.workspace.ui.wallpath.WallPathInteractionController;

import java.util.Objects;

public final class DungeonPaneInputContextAdapter implements DungeonPaneInputContext {

    private final AbstractDungeonPane pane;
    private final DungeonPaneRenderState renderState;
    private final DungeonPanePreviewModel previewModel;
    private DungeonPaneInteractionSink interactionSink = DungeonPaneInteractionSink.NO_OP;
    private CorridorEditInteractionController corridorController;
    private WallPathInteractionController wallPathController;

    public DungeonPaneInputContextAdapter(
            AbstractDungeonPane pane,
            DungeonPaneRenderState renderState,
            DungeonPanePreviewModel previewModel
    ) {
        this.pane = Objects.requireNonNull(pane, "pane");
        this.renderState = Objects.requireNonNull(renderState, "renderState");
        this.previewModel = Objects.requireNonNull(previewModel, "previewModel");
    }

    public void bindInteractionSink(DungeonPaneInteractionSink interactionSink) {
        this.interactionSink = Objects.requireNonNull(interactionSink, "interactionSink");
    }

    public void bindControllers(
            CorridorEditInteractionController corridorController,
            WallPathInteractionController wallPathController
    ) {
        this.corridorController = Objects.requireNonNull(corridorController, "corridorController");
        this.wallPathController = Objects.requireNonNull(wallPathController, "wallPathController");
    }

    @Override
    public boolean editable() {
        return renderState.editable();
    }

    @Override
    public DungeonEditorTool editorTool() {
        return renderState.editorTool();
    }

    @Override
    public DungeonEditorSurface surface() {
        return pane.surface();
    }

    @Override
    public DungeonPaneInteractionSink events() {
        return interactionSink;
    }

    @Override
    public DungeonPaneInteractionState interactionState() {
        return previewModel.interactionState();
    }

    @Override
    public DungeonPanePointerTracker pointerTracker() {
        return previewModel.pointerTracker();
    }

    @Override
    public CorridorEditInteractionController controller() {
        Objects.requireNonNull(corridorController, "corridorController");
        return corridorController;
    }

    @Override
    public WallPathInteractionController wallPathController() {
        Objects.requireNonNull(wallPathController, "wallPathController");
        return wallPathController;
    }

    @Override
    public CorridorDoorHandle selectedCorridorDoorHandle() {
        return renderState.previewState().selectedCorridorDoorHandle();
    }
}
