package features.world.api;

import javafx.scene.Node;

public interface WorldTravelSurface {

    default Node sceneContent() {
        return null;
    }

    void showOverworldTravel();

    void showDungeonTravel(
            String mapName,
            String areaLabel,
            String tileLabel,
            String statusLabel,
            Runnable centerAction
    );
}
