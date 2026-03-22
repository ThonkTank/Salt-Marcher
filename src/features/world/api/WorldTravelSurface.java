package features.world.api;

public interface WorldTravelSurface {

    void showOverworldTravel();

    void showDungeonTravel(
            String mapName,
            String locationLabel,
            String tileLabel,
            String statusLabel,
            Runnable centerAction
    );
}
