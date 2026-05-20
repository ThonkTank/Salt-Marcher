package src.domain.dungeon.model.travel.model.session.model;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSnapshot.SnapshotData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.ContextKind;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.TravelOverlayState;

public final class TravelDungeonSession {

    private final State state = new State();

    public void primeRequestedPosition(@Nullable PositionData position) {
        if (state.currentSurface == null && state.requestedPosition == null && position != null) {
            state.requestedPosition = position;
        }
    }

    public boolean hasCurrentSurface() {
        return state.currentSurface != null;
    }

    public @Nullable PositionData requestedPosition() {
        return state.requestedPosition;
    }

    public @Nullable PositionData currentPosition() {
        if (state.currentSurface == null || state.currentSurface.contextKind() != ContextKind.DUNGEON) {
            return state.requestedPosition;
        }
        return state.currentSurface.position();
    }

    public void applySurface(SurfaceData surface) {
        state.currentSurface = surface;
    }

    public @Nullable SurfaceData currentSurface() {
        return state.currentSurface;
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
        state.overlayState = TravelOverlayState.of(modeKey, levelRange, opacity, selectedLevels);
    }

    public void stabilizeProjectionLevel(int nextProjectionLevel, boolean initialized) {
        state.projectionLevel = nextProjectionLevel;
        state.projectionLevelInitialized = initialized;
    }

    public SnapshotData snapshot() {
        return new SnapshotData(state.currentSurface, state.overlayState, state.projectionLevel);
    }

    private static final class State {
        private TravelOverlayState overlayState = TravelOverlayState.defaults();
        private int projectionLevel;
        private boolean projectionLevelInitialized;
        private @Nullable PositionData requestedPosition;
        private @Nullable SurfaceData currentSurface;
    }
}
