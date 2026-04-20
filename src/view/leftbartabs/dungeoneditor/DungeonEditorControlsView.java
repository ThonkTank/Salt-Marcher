package src.view.leftbartabs.dungeoneditor;

import javafx.scene.control.Button;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelView;

public final class DungeonEditorControlsView extends DungeonControlPanelView {

    private final Button createButton = new Button("New map");

    public DungeonEditorControlsView() {
        super("Dungeon Editor");
        addControl(createButton);
    }

    public void onCreateMap(Runnable action) {
        createButton.setOnAction(event -> action.run());
    }
}
