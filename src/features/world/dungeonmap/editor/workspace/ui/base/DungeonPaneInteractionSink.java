package features.world.dungeonmap.editor.workspace.ui.base;

public interface DungeonPaneInteractionSink extends DungeonPaneSelectionSink, DungeonPaneEditSink, DungeonPaneViewportSink {

    DungeonPaneInteractionSink NO_OP = new DungeonPaneInteractionSink() {
    };
}
