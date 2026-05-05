package src.domain.travel.application;

import java.util.List;
import java.util.SortedSet;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;

final class StabilizeTravelDungeonProjectionUseCase {

    ProjectionLevelState stabilize(
            ApplyTravelDungeonSessionUseCase.@Nullable SurfaceData currentSurface,
            int projectionLevel,
            boolean projectionLevelInitialized
    ) {
        if (currentSurface == null) {
            return new ProjectionLevelState(projectionLevel, projectionLevelInitialized);
        }
        int effectiveProjectionLevel = projectionLevel;
        boolean initialized = projectionLevelInitialized;
        if (!initialized) {
            effectiveProjectionLevel = defaultProjectionLevel(currentSurface, effectiveProjectionLevel);
            initialized = true;
        }
        effectiveProjectionLevel = clampProjectionLevel(currentSurface, effectiveProjectionLevel);
        return new ProjectionLevelState(effectiveProjectionLevel, initialized);
    }

    private static int defaultProjectionLevel(
            ApplyTravelDungeonSessionUseCase.SurfaceData surface,
            int fallbackLevel
    ) {
        return surface.contextKind() == ApplyTravelDungeonSessionUseCase.ContextKind.DUNGEON
                ? surface.position().tile().level()
                : fallbackLevel;
    }

    private static int clampProjectionLevel(
            ApplyTravelDungeonSessionUseCase.SurfaceData surface,
            int fallbackLevel
    ) {
        List<Integer> levels = levelsFrom(surface, fallbackLevel);
        if (levels.isEmpty()) {
            return fallbackLevel;
        }
        return Math.max(levels.getFirst(), Math.min(levels.getLast(), fallbackLevel));
    }

    private static List<Integer> levelsFrom(
            ApplyTravelDungeonSessionUseCase.SurfaceData surface,
            int fallbackLevel
    ) {
        SortedSet<Integer> levels = new TreeSet<>();
        ApplyTravelDungeonSessionUseCase.MapData map = surface.map();
        map.areas().forEach(area -> area.cells().forEach(cell -> levels.add(cell.level())));
        map.features().forEach(feature -> feature.cells().forEach(cell -> levels.add(cell.level())));
        if (levels.isEmpty()) {
            levels.add(fallbackLevel);
        }
        return List.copyOf(levels);
    }

    record ProjectionLevelState(int level, boolean initialized) {
    }
}
