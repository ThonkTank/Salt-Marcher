package src.domain.dungeon.model.runtime.usecase;

import java.util.List;
import java.util.SortedSet;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.ContextKind;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.MapData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.SurfaceData;

public final class StabilizeTravelDungeonProjectionUseCase {

    public ProjectionLevelState stabilize(
            @Nullable SurfaceData currentSurface,
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
        SortedSet<Integer> levels = new TreeSet<>();
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

    public record ProjectionLevelState(int level, boolean initialized) {
    }
}
