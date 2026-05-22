package src.domain.dungeon.model.editor.helper;

import java.util.ArrayList;
import java.util.List;
import java.util.NavigableSet;
import java.util.Set;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Area;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Cell;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Feature;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Handle;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;

public final class DungeonEditorSnapshotProjectionLevelProjectionHelper {

    private DungeonEditorSnapshotProjectionLevelProjectionHelper() {
    }

    public static int clampProjectionLevel(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
            int projectionLevel
    ) {
        List<Integer> levels = levelsFrom(surface, projectionLevel);
        if (levels.isEmpty()) {
            return projectionLevel;
        }
        return Math.max(levels.getFirst(), Math.min(levels.getLast(), projectionLevel));
    }

    private static List<Integer> levelsFrom(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
            int fallbackLevel
    ) {
        NavigableSet<Integer> levels = new TreeSet<>();
        addSurfaceLevels(levels, surface);
        addFallbackLevel(levels, fallbackLevel);
        return new ArrayList<>(levels);
    }

    private static void addSurfaceLevels(
            Set<Integer> levels,
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface
    ) {
        if (surface == null) {
            return;
        }
        addMapLevels(levels, surface.map());
        addMapLevels(levels, surface.previewMap());
    }

    private static void addMapLevels(Set<Integer> levels, @Nullable MapSnapshot map) {
        if (map == null) {
            return;
        }
        addAreaLevels(levels, map.areas());
        addFeatureLevels(levels, map.features());
        addHandleLevels(levels, map.editorHandles());
    }

    private static void addAreaLevels(Set<Integer> levels, List<Area> areas) {
        for (Area area : areas == null ? List.<Area>of() : areas) {
            addCellLevels(levels, area.cells());
        }
    }

    private static void addFeatureLevels(Set<Integer> levels, List<Feature> features) {
        for (Feature feature : features == null ? List.<Feature>of() : features) {
            addCellLevels(levels, feature.cells());
        }
    }

    private static void addHandleLevels(Set<Integer> levels, List<Handle> handles) {
        for (Handle handle : handles == null ? List.<Handle>of() : handles) {
            levels.add(handle.cell().level());
        }
    }

    private static void addCellLevels(Set<Integer> levels, List<Cell> cells) {
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            levels.add(cell.level());
        }
    }

    private static void addFallbackLevel(Set<Integer> levels, int fallbackLevel) {
        if (levels.isEmpty()) {
            levels.add(fallbackLevel);
        }
    }
}
