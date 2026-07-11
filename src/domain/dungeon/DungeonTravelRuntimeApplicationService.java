package src.domain.dungeon;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.runtime.travel.projection.TravelActionFacts.SelectedAction;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSession;
import src.domain.dungeon.published.DungeonOverlaySettings;

/**
 * Public backend facade for runtime travel composition.
 */
public final class DungeonTravelRuntimeApplicationService {
    private static final long NO_MAP_ID = 0L;

    private final TravelDungeonSession session = new TravelDungeonSession();
    private final DungeonTravelSurfaceLoader surfaceLoader;
    private final DungeonTravelNavigator navigator;
    private final DungeonTravelPublishedState publishedState;

    public DungeonTravelRuntimeApplicationService(
            DungeonTravelSurfaceLoader surfaceLoader,
            DungeonTravelNavigator navigator,
            DungeonTravelPublishedState publishedState
    ) {
        this.surfaceLoader = Objects.requireNonNull(surfaceLoader, "surfaceLoader");
        this.navigator = Objects.requireNonNull(navigator, "navigator");
        this.publishedState = Objects.requireNonNull(publishedState, "publishedState");
    }

    public void refresh() {
        session.applySurface(surfaceLoader.loadCurrentPosition(session.currentPosition()));
        publishSnapshot();
    }

    public void performAction(int selectedActionRowIndex) {
        session.applySurface(navigator.move(
                session.currentPosition(),
                session.currentSurface(),
                SelectedAction.atRow(selectedActionRowIndex)));
        publishSnapshot();
    }

    public void selectMap(long mapId) {
        if (mapId > NO_MAP_ID) {
            session.applySurface(surfaceLoader.loadSelectedMap(mapId));
        }
        publishSnapshot();
    }

    public void shiftProjectionLevel(int projectionLevelShift) {
        session.setProjectionLevel(session.projectionLevel() + projectionLevelShift);
        publishSnapshot();
    }

    public void setOverlay(DungeonOverlaySettings overlaySettings) {
        DungeonOverlaySettings safeOverlay = overlaySettings == null
                ? DungeonOverlaySettings.defaults()
                : overlaySettings;
        session.setOverlay(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                selectedLevels(safeOverlay));
        publishSnapshot();
    }

    private void publishSnapshot() {
        if (!session.hasCurrentSurface()) {
            session.applySurface(surfaceLoader.loadCurrentPosition(null));
        }
        session.stabilizeProjectionLevel();
        publishedState.publish(session.snapshot());
    }

    private static List<Integer> selectedLevels(DungeonOverlaySettings overlaySettings) {
        return overlaySettings == null ? List.of() : overlaySettings.selectedLevels();
    }
}
