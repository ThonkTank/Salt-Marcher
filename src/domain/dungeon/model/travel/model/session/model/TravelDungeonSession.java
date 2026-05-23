package src.domain.dungeon.model.travel.model.session.model;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSnapshot.SnapshotData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.ContextKind;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.TravelOverlayState;

public final class TravelDungeonSession {

    private final MutableTravelSessionState state = new MutableTravelSessionState();

    public boolean hasCurrentSurface() {
        return state.surfaceLoaded();
    }

    public @Nullable PositionData requestedPosition() {
        return state.requestedPosition;
    }

    public @Nullable PositionData currentPosition() {
        return state.navigationOrigin();
    }

    public void applySurface(SurfaceData surface) {
        state.replaceSurface(surface);
    }

    public @Nullable SurfaceData currentSurface() {
        return state.loadedSurface();
    }

    public int projectionLevel() {
        return state.projectionLevel;
    }

    public boolean projectionLevelInitialized() {
        return state.projectionLevelInitialized;
    }

    public void setProjectionLevel(int nextProjectionLevel) {
        state.projectionLevel = nextProjectionLevel;
    }

    public void setOverlay(String modeKey, int levelRange, double opacity, List<Integer> selectedLevels) {
        state.configureOverlay(modeKey, levelRange, opacity, selectedLevels);
    }

    public void stabilizeProjectionLevel(int nextProjectionLevel, boolean initialized) {
        state.projectionLevel = nextProjectionLevel;
        state.projectionLevelInitialized = initialized;
    }

    public SnapshotData snapshot() {
        return state.snapshot();
    }

    private static final class MutableTravelSessionState {

        private TravelOverlayState overlayState = TravelOverlayState.defaults();
        private int projectionLevel;
        private boolean projectionLevelInitialized;
        private @Nullable PositionData requestedPosition;
        private @Nullable SurfaceData currentSurface;

        private boolean surfaceLoaded() {
            return currentSurface != null;
        }

        private @Nullable PositionData navigationOrigin() {
            if (currentSurface == null || currentSurface.contextKind() != ContextKind.DUNGEON) {
                return requestedPosition;
            }
            return currentSurface.position();
        }

        private @Nullable SurfaceData loadedSurface() {
            return currentSurface;
        }

        private void replaceSurface(SurfaceData surface) {
            currentSurface = surface;
        }

        private void configureOverlay(String modeKey, int levelRange, double opacity, List<Integer> selectedLevels) {
            overlayState = TravelOverlayState.of(modeKey, levelRange, opacity, selectedLevels);
        }

        private SnapshotData snapshot() {
            return new SnapshotData(currentSurface, overlayState, projectionLevel);
        }
    }
}
