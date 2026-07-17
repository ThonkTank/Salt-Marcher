package features.dungeon.application.travel;

import java.util.List;
import java.util.Objects;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import features.dungeon.application.travel.projection.TravelActionFacts.SelectedAction;
import features.dungeon.application.travel.session.TravelDungeonSession;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.OverlayMode;
import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.api.travel.DungeonTravelApi;

/**
 * Public backend facade for runtime travel composition.
 */
public final class DungeonTravelRuntimeApplicationService implements DungeonTravelApi {
    private static final long NO_MAP_ID = 0L;

    private final TravelDungeonSession session = new TravelDungeonSession();
    private final DungeonTravelSurfaceLoader surfaceLoader;
    private final DungeonTravelNavigator navigator;
    private final DungeonTravelPublishedState publishedState;
    private final ExecutionLane executionLane;

    public DungeonTravelRuntimeApplicationService(
            DungeonTravelSurfaceLoader surfaceLoader,
            DungeonTravelNavigator navigator,
            DungeonTravelPublishedState publishedState
    ) {
        this(surfaceLoader, navigator, publishedState, DirectExecutionLane.INSTANCE);
    }

    public DungeonTravelRuntimeApplicationService(
            DungeonTravelSurfaceLoader surfaceLoader,
            DungeonTravelNavigator navigator,
            DungeonTravelPublishedState publishedState,
            ExecutionLane executionLane
    ) {
        this.surfaceLoader = Objects.requireNonNull(surfaceLoader, "surfaceLoader");
        this.navigator = Objects.requireNonNull(navigator, "navigator");
        this.publishedState = Objects.requireNonNull(publishedState, "publishedState");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
    }

    public void refresh() {
        executionLane.execute(this::refreshOnLane);
    }

    private void refreshOnLane() {
        session.applySurface(surfaceLoader.loadCurrentPosition(session.currentPosition()));
        publishSnapshot();
    }

    public void performAction(int selectedActionRowIndex) {
        executionLane.execute(() -> performActionOnLane(selectedActionRowIndex));
    }

    private void performActionOnLane(int selectedActionRowIndex) {
        session.applySurface(navigator.move(
                session.currentPosition(),
                session.currentSurface(),
                SelectedAction.atRow(selectedActionRowIndex)));
        publishSnapshot();
    }

    public void selectMap(long mapId) {
        executionLane.execute(() -> selectMapOnLane(mapId));
    }

    private void selectMapOnLane(long mapId) {
        if (mapId > NO_MAP_ID) {
            session.applySurface(surfaceLoader.loadSelectedMap(mapId));
        }
        publishSnapshot();
    }

    public void shiftProjectionLevel(int projectionLevelShift) {
        executionLane.execute(() -> shiftProjectionLevelOnLane(projectionLevelShift));
    }

    private void shiftProjectionLevelOnLane(int projectionLevelShift) {
        session.setProjectionLevel(session.projectionLevel() + projectionLevelShift);
        publishSnapshot();
    }

    public void setOverlay(DungeonOverlaySettings overlaySettings) {
        executionLane.execute(() -> setOverlayOnLane(overlaySettings));
    }

    private void setOverlayOnLane(DungeonOverlaySettings overlaySettings) {
        DungeonOverlaySettings safeOverlay = overlaySettings == null
                ? DungeonOverlaySettings.defaults()
                : overlaySettings;
        session.setOverlay(
                OverlayMode.fromKey(safeOverlay.modeKey()),
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
