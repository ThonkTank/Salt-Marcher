package features.world.quarantine.dungeonmap.editor.workspace.contract;

public interface DungeonPaneInteractionSink
        extends DungeonPaneSelectionSink, DungeonPaneMutationSink, DungeonPaneViewportSink {

    DungeonPaneInteractionSink NO_OP = new DungeonPaneInteractionSinkAdapter();
}
