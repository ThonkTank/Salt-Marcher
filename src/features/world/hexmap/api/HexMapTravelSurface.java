package features.world.hexmap.api;

import features.world.api.WorldTravelSurface;
import features.world.hexmap.ui.travel.TravelPane;
import javafx.scene.Node;

public final class HexMapTravelSurface implements WorldTravelSurface {

    private final TravelPane pane = new TravelPane();

    public Node sceneContent() {
        return pane;
    }

    @Override
    public void showOverworldTravel() {
        pane.showOverworldTravel();
    }

    @Override
    public void showDungeonTravel(
            String mapName,
            String locationLabel,
            String tileLabel,
            String statusLabel,
            Runnable centerAction
    ) {
        pane.showDungeonTravel(mapName, locationLabel, tileLabel, statusLabel, centerAction);
    }
}
