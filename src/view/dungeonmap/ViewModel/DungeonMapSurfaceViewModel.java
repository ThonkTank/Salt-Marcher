package src.view.dungeonshared.ViewModel;

import java.util.List;
import org.jspecify.annotations.Nullable;

public interface DungeonMapSurfaceViewModel {

    void addListener(Runnable listener);

    DungeonMapSurfaceViewState viewState();

    String defaultMapName();

    void setSearchText(String value);

    void selectMap(@Nullable Long mapId);

    void loadSelected(DungeonViewportViewModel viewport);

    void createMap(String mapName, DungeonViewportViewModel viewport);

    void deleteLoaded();

    void stepFloor(int delta, DungeonViewportViewModel viewport);

    void updateOverlay(DungeonOverlaySettings settings, DungeonViewportViewModel viewport);

    void moveRoomAnchor(
            int deltaQ,
            int deltaR,
            @Nullable DungeonSelectionItemViewModel selectedTarget,
            DungeonViewportViewModel viewport);

    List<String> lastMutationMessages();
}
