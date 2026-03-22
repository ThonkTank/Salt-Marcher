package features.world.api;

import javafx.scene.Node;

import java.util.List;

public interface WorldTravelSurface {

    record DungeonDoorAction(String label, Runnable action) {
    }

    default Node sceneContent() {
        return null;
    }

    void showOverworldTravel();

    void showDungeonTravel(
            String mapName,
            String areaLabel,
            String tileLabel,
            String headingLabel,
            String statusLabel,
            List<DungeonDoorAction> doorActions,
            Runnable centerAction
    );
}
