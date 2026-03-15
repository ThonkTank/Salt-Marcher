package features.world.dungeonmap.ui.shared;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.Point2i;
import javafx.geometry.Orientation;
import javafx.scene.layout.BorderPane;
import javafx.scene.control.SplitPane;

import java.util.function.BiConsumer;
import java.util.function.Consumer;

public final class DungeonSplitWorkspace extends BorderPane {

    private final DungeonGridPane gridPane = new DungeonGridPane();
    private final DungeonGraphPane graphPane = new DungeonGraphPane();

    public DungeonSplitWorkspace(boolean editable) {
        SplitPane splitPane = new SplitPane(gridPane, graphPane);
        splitPane.setOrientation(Orientation.HORIZONTAL);
        splitPane.setDividerPositions(0.64);
        setCenter(splitPane);
        gridPane.setEditable(editable);
        graphPane.setEditable(editable);
    }

    public void showLayout(DungeonLayout layout, Long selectedRoomId, Long activeRoomId) {
        gridPane.showLayout(layout, selectedRoomId, activeRoomId);
        graphPane.showLayout(layout, selectedRoomId, activeRoomId);
    }

    public void setOnRoomSelected(Consumer<DungeonRoom> onRoomSelected) {
        gridPane.setOnRoomSelected(onRoomSelected);
        graphPane.setOnRoomSelected(onRoomSelected);
    }

    public void setOnRoomMoved(BiConsumer<DungeonRoom, Point2i> onRoomMoved) {
        gridPane.setOnRoomMoved(onRoomMoved);
        graphPane.setOnRoomMoved(onRoomMoved);
    }
}
