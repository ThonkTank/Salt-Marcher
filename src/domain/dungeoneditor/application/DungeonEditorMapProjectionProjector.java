package src.domain.dungeoneditor;

import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionSnapshot;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorMapProjectionProjector {

    private DungeonEditorMapProjectionProjector() {
    }

    public static @Nullable DungeonEditorMapProjectionSnapshot projection(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
            DungeonEditorSessionValues.@Nullable Selection selection,
            DungeonEditorSessionValues.@Nullable Preview preview
    ) {
        if (surface == null) {
            return null;
        }
        DungeonEditorSessionValues.Selection safeSelection = selection == null
                ? DungeonEditorSessionValues.Selection.empty()
                : selection;
        DungeonEditorSessionValues.Preview safePreview = preview == null
                ? DungeonEditorSessionValues.Preview.none()
                : preview;
        DungeonEditorProjectionAssemblyProjector.ProjectionAccumulator projection =
                DungeonEditorProjectionAssemblyProjector.assemble(surface, safeSelection, safePreview);
        DungeonEditorWorkspaceValues.MapSnapshot map = surface.map();
        return new DungeonEditorMapProjectionSnapshot(
                surface.mapName(),
                DungeonEditorProjectionPublishedBoundaryTranslator.topology(map.topology()),
                map.width(),
                map.height(),
                projection.cells(),
                projection.edges(),
                projection.labels(),
                projection.markers(),
                projection.graphNodes(),
                projection.graphLinks(),
                null);
    }
}
