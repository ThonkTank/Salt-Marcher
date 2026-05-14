package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
import java.util.SortedSet;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorCell;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorSurface;

final class SurfaceLevels {

    private SurfaceLevels() {
    }

    static List<Integer> from(@Nullable DungeonEditorSurface surface, int fallbackLevel) {
        SortedSet<Integer> levels = new TreeSet<>();
        if (surface != null && surface.map() != null) {
            surface.map().areas().forEach(area -> addCellLevels(levels, area.cells()));
            for (DungeonEditorMapSnapshot.Feature feature : surface.map().features()) {
                addCellLevels(levels, feature.cells());
            }
            surface.map().editorHandles().forEach(handle -> levels.add(handle.cell().level()));
            if (surface.previewMap() != null) {
                surface.previewMap().areas().forEach(area -> addCellLevels(levels, area.cells()));
                for (DungeonEditorMapSnapshot.Feature feature : surface.previewMap().features()) {
                    addCellLevels(levels, feature.cells());
                }
                surface.previewMap().editorHandles().forEach(handle -> levels.add(handle.cell().level()));
            }
        }
        if (levels.isEmpty()) {
            levels.add(fallbackLevel);
        }
        return new ArrayList<>(levels);
    }

    private static void addCellLevels(SortedSet<Integer> levels, List<DungeonEditorCell> cells) {
        for (DungeonEditorCell cell : cells == null ? List.<DungeonEditorCell>of() : cells) {
            levels.add(cell.level());
        }
    }
}
