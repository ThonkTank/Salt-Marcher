package src.view.dungeonmap.View;

import javafx.scene.Node;

public interface DungeonControlsExtensionTarget {
    void setMapRowActions(Node... nodes);

    void setModeControls(Node... nodes);

    void setSecondaryActions(Node... nodes);

    void setFooterContent(Node... nodes);
}
