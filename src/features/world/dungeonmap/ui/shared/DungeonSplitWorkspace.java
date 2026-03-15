package features.world.dungeonmap.ui.shared;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.Point2i;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.StackPane;

import java.util.function.BiConsumer;
import java.util.function.Consumer;

public final class DungeonSplitWorkspace extends BorderPane {

    private final DungeonGridPane gridPane = new DungeonGridPane();
    private final DungeonGraphPane graphPane = new DungeonGraphPane();
    private final StackPane workspacePane = new StackPane(gridPane, graphPane);
    private DungeonViewMode viewMode = DungeonViewMode.GRID;

    public DungeonSplitWorkspace(boolean editable) {
        setCenter(workspacePane);
        gridPane.setEditable(editable);
        graphPane.setEditable(editable);
        applyViewMode();
    }

    public void showLayout(DungeonLayout layout, Long selectedRoomId, Long activeRoomId) {
        gridPane.showLayout(layout, selectedRoomId, activeRoomId);
        graphPane.showLayout(layout, selectedRoomId, activeRoomId);
        applyViewMode();
    }

    public void setViewMode(DungeonViewMode viewMode) {
        this.viewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        applyViewMode();
    }

    public void setOnRoomSelected(Consumer<DungeonRoom> onRoomSelected) {
        gridPane.setOnRoomSelected(onRoomSelected);
        graphPane.setOnRoomSelected(onRoomSelected);
    }

    public void setOnRoomMoved(BiConsumer<DungeonRoom, Point2i> onRoomMoved) {
        gridPane.setOnRoomMoved(onRoomMoved);
        graphPane.setOnRoomMoved(onRoomMoved);
    }

    private void applyViewMode() {
        // Grid and graph are two projections of the same room anchor coordinates.
        // They must never drift into separate positioning states.
        boolean showGrid = viewMode == DungeonViewMode.GRID;
        gridPane.setVisible(showGrid);
        gridPane.setManaged(showGrid);
        graphPane.setVisible(!showGrid);
        graphPane.setManaged(!showGrid);
        if (showGrid) {
            gridPane.toFront();
        } else {
            graphPane.toFront();
        }
    }
}
