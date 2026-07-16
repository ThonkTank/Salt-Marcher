package features.dungeon.application.travel.session;

import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.application.travel.session.TravelDungeonSessionSnapshot.SnapshotData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.ContextKind;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.MapData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.OverlayMode;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.OverlayState;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.PositionData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.SurfaceData;

public final class TravelDungeonSession {

    private final MutableTravelSessionState state = new MutableTravelSessionState();

    public boolean hasCurrentSurface() {
        return state.surfaceLoaded();
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

    public void setProjectionLevel(int nextProjectionLevel) {
        state.projectionLevel = nextProjectionLevel;
    }

    public void setOverlay(OverlayMode mode, int levelRange, double opacity, List<Integer> selectedLevels) {
        state.configureOverlay(mode, levelRange, opacity, selectedLevels);
    }

    public void stabilizeProjectionLevel() {
        state.stabilizeProjectionLevel();
    }

    public SnapshotData snapshot() {
        return state.snapshot();
    }

    private static final class MutableTravelSessionState {

        private OverlayState overlayState = OverlayState.defaults();
        private int projectionLevel;
        private boolean projectionLevelInitialized;
        private @Nullable SurfaceData currentSurface;

        private boolean surfaceLoaded() {
            return currentSurface != null;
        }

        private @Nullable PositionData navigationOrigin() {
            if (currentSurface == null
                    || currentSurface.contextKind() != ContextKind.DUNGEON
                    || !currentSurface.navigationEnabled()) {
                return null;
            }
            return currentSurface.position();
        }

        private @Nullable SurfaceData loadedSurface() {
            return currentSurface;
        }

        private void replaceSurface(SurfaceData surface) {
            currentSurface = surface;
        }

        private void configureOverlay(OverlayMode mode, int levelRange, double opacity, List<Integer> selectedLevels) {
            overlayState = OverlayState.of(mode, levelRange, opacity, selectedLevels);
        }

        private void stabilizeProjectionLevel() {
            if (currentSurface == null) {
                return;
            }
            if (!projectionLevelInitialized) {
                projectionLevel = defaultProjectionLevel(currentSurface, projectionLevel);
                projectionLevelInitialized = true;
            }
            projectionLevel = clampProjectionLevel(currentSurface, projectionLevel);
        }

        private SnapshotData snapshot() {
            return TravelDungeonSessionSnapshot.snapshot(currentSurface, overlayState, projectionLevel);
        }

        private static int defaultProjectionLevel(SurfaceData surface, int fallbackLevel) {
            return surface.contextKind() == ContextKind.DUNGEON
                    ? surface.position().tile().level()
                    : fallbackLevel;
        }

        private static int clampProjectionLevel(SurfaceData surface, int fallbackLevel) {
            List<Integer> levels = levelsFrom(surface, fallbackLevel);
            if (levels.isEmpty()) {
                return fallbackLevel;
            }
            return Math.max(levels.getFirst(), Math.min(levels.getLast(), fallbackLevel));
        }

        private static List<Integer> levelsFrom(SurfaceData surface, int fallbackLevel) {
            java.util.SortedSet<Integer> levels = new java.util.TreeSet<>();
            MapData map = surface.map();
            for (var area : map.areas()) {
                for (var cell : area.cells()) {
                    levels.add(cell.level());
                }
            }
            for (var feature : map.features()) {
                for (var cell : feature.cells()) {
                    levels.add(cell.level());
                }
            }
            if (levels.isEmpty()) {
                levels.add(fallbackLevel);
            }
            return List.copyOf(levels);
        }
    }
}
