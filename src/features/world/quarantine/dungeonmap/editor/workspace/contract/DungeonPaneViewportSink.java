package features.world.quarantine.dungeonmap.editor.workspace.contract;

import javafx.geometry.Point2D;

public interface DungeonPaneViewportSink {

    default void onViewportPanStarted(Point2D point) {
    }

    default void onViewportPanned(Point2D point) {
    }

    default void onViewportZoomed(double screenX, double screenY, double factor) {
    }
}
