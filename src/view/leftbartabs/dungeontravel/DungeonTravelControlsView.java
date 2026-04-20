package src.view.leftbartabs.dungeontravel;

import javafx.scene.control.Button;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelView;

public final class DungeonTravelControlsView extends DungeonControlPanelView {

    private final Button refreshButton = new Button("Refresh");

    public DungeonTravelControlsView() {
        super("Dungeon Travel");
        addControl(refreshButton);
    }

    public void onRefresh(Runnable action) {
        refreshButton.setOnAction(event -> action.run());
    }
}
