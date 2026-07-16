package features.dungeon.application.editor;

import java.util.ArrayList;
import java.util.List;
import java.util.SortedSet;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.session.DungeonEditorSessionSnapshot;
import features.dungeon.api.DungeonEditorSurface;

final class DungeonEditorSurfaceContextServiceAssembly {

    private DungeonEditorSurfaceContextServiceAssembly() {
    }

    static SurfaceContext surfaceContext(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
            int fallbackLevel
    ) {
        ControlsContext controlsContext = controlsContext(surface, fallbackLevel);
        return new SurfaceContext(
                DungeonEditorMapProjectionServiceAssembly.surface(surface),
                controlsContext.reachableLevels(),
                controlsContext.surfacePresent());
    }

    static ControlsContext controlsContext(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
            int fallbackLevel
    ) {
        SortedSet<Integer> levels = new TreeSet<>();
        if (surface != null && surface.map() != null) {
            addWorkspaceMapLevels(levels, surface.map());
            if (surface.previewMap() != null) {
                addWorkspaceMapLevels(levels, surface.previewMap());
            }
        }
        if (levels.isEmpty()) {
            levels.add(fallbackLevel);
        }
        return new ControlsContext(new ArrayList<>(levels), surface != null);
    }

    private static void addWorkspaceMapLevels(
            SortedSet<Integer> levels,
            features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot map
    ) {
        for (features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Area area : map.areas()) {
            addWorkspaceCellLevels(levels, area.cells());
        }
        for (features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Feature feature : map.features()) {
            addWorkspaceCellLevels(levels, feature.cells());
        }
        for (features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Handle handle : map.editorHandles()) {
            levels.add(handle.cell().level());
        }
    }

    private static void addWorkspaceCellLevels(
            SortedSet<Integer> levels,
            List<features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Cell> cells
    ) {
        for (features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Cell cell
                : cells == null ? List.<features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Cell>of() : cells) {
            levels.add(cell.level());
        }
    }

    record SurfaceContext(
            @Nullable DungeonEditorSurface surface,
            List<Integer> reachableLevels,
            boolean surfacePresent
    ) {
    }

    record ControlsContext(
            List<Integer> reachableLevels,
            boolean surfacePresent
    ) {
    }
}
