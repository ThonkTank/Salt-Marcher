package src.domain.dungeon.model.travel.model.session.model;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSnapshot.SnapshotData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.ContextKind;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.TravelOverlayState;

public final class TravelDungeonSession {

    private TravelOverlayState overlayState = TravelOverlayState.defaults();
    private int projectionLevel;
    private boolean projectionLevelInitialized;
    private @Nullable PositionData requestedPosition;
    private @Nullable SurfaceData currentSurface;

    public void primeRequestedPosition(@Nullable PositionData position) {
        if (currentSurface == null && requestedPosition == null && position != null) {
            requestedPosition = position;
        }
    }

    public boolean hasCurrentSurface() {
        return currentSurface != null;
    }

    public @Nullable PositionData requestedPosition() {
        return requestedPosition;
    }

    public @Nullable PositionData currentPosition() {
        if (currentSurface == null || currentSurface.contextKind() != ContextKind.DUNGEON) {
            return requestedPosition;
        }
        return currentSurface.position();
    }

    public void applySurface(SurfaceData surface) {
        currentSurface = surface;
    }

    public @Nullable SurfaceData currentSurface() {
        return currentSurface;
    }

    public int projectionLevel() {
        return projectionLevel;
    }

    public boolean projectionLevelInitialized() {
        return projectionLevelInitialized;
    }

    public void setProjectionLevel(int nextProjectionLevel) {
        projectionLevel = nextProjectionLevel;
    }

    public void setOverlay(String modeKey, int levelRange, double opacity, List<Integer> selectedLevels) {
        overlayState = TravelOverlayState.of(modeKey, levelRange, opacity, selectedLevels);
    }

    public void stabilizeProjectionLevel(int nextProjectionLevel, boolean initialized) {
        projectionLevel = nextProjectionLevel;
        projectionLevelInitialized = initialized;
    }

    public SnapshotData snapshot() {
        return new SnapshotData(currentSurface, overlayState, projectionLevel);
    }
}
