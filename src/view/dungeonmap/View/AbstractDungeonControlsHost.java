package src.view.dungeonmap.View;

import java.util.Objects;
import javafx.scene.Node;

abstract class AbstractDungeonControlsHost implements DungeonControlsExtensionTarget {
    private final DungeonControlsPanel controlsPanel;

    AbstractDungeonControlsHost(DungeonControlsPanel controlsPanel) {
        this.controlsPanel = Objects.requireNonNull(controlsPanel, "controlsPanel");
    }

    public final Node content() {
        return controlsPanel;
    }

    public final void refresh() {
        controlsPanel.refresh();
    }

    @Override
    public final void setMapRowActions(Node... nodes) {
        controlsPanel.setMapRowActions(nodes);
    }

    @Override
    public final void setModeControls(Node... nodes) {
        controlsPanel.setModeControls(nodes);
    }

    @Override
    public final void setSecondaryActions(Node... nodes) {
        controlsPanel.setSecondaryActions(nodes);
    }

    @Override
    public final void setFooterContent(Node... nodes) {
        controlsPanel.setFooterContent(nodes);
    }
}
