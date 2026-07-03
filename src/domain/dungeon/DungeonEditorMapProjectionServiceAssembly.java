package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorSurface;

final class DungeonEditorMapProjectionServiceAssembly {

    private DungeonEditorMapProjectionServiceAssembly() {
    }

    static @Nullable DungeonEditorSurface surface(DungeonEditorSessionSnapshot.@Nullable SurfaceData surface) {
        if (surface == null) {
            return null;
        }
        DungeonEditorMapSnapshot committedMap = map(surface.map());
        DungeonEditorMapSnapshot previewMap = surface.previewMap() == null ? null : map(surface.previewMap());
        return new DungeonEditorSurface(
                surface.mapName(),
                surface.revision(),
                committedMap,
                previewMap,
                DungeonEditorPreviewDiffProjectionServiceAssembly.previewDiff(committedMap, previewMap),
                DungeonEditorInspectorProjectionServiceAssembly.inspector(surface.inspector()));
    }

    private static DungeonEditorMapSnapshot map(
            src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot map
    ) {
        src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot safeMap = map == null
                ? src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot.empty()
                : map;
        return new DungeonEditorMapSnapshot(
                safeMap.topology().name(),
                safeMap.width(),
                safeMap.height(),
                areas(safeMap.areas()),
                boundaries(safeMap.boundaries()),
                features(safeMap.features()),
                handles(safeMap.editorHandles()));
    }

    private static List<DungeonEditorMapSnapshot.Area> areas(
            List<src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Area> areas
    ) {
        List<DungeonEditorMapSnapshot.Area> result = new ArrayList<>();
        for (src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Area area
                : areas == null ? List.<src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Area>of() : areas) {
            result.add(area(area));
        }
        return List.copyOf(result);
    }

    private static DungeonEditorMapSnapshot.Area area(
            src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.@Nullable Area area
    ) {
        if (area == null) {
            return new DungeonEditorMapSnapshot.Area(
                    "ROOM",
                    1L,
                    0L,
                    "ROOM",
                    List.of(),
                    src.domain.dungeon.published.DungeonEditorTopologyElementRef.empty());
        }
        return new DungeonEditorMapSnapshot.Area(
                area.kind().name(),
                area.id(),
                area.clusterId(),
                area.label(),
                DungeonEditorValueProjectionServiceAssembly.cells(area.cells()),
                DungeonEditorValueProjectionServiceAssembly.topologyRef(area.topologyRef()));
    }

    private static List<DungeonEditorMapSnapshot.Boundary> boundaries(
            List<src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Boundary> boundaries
    ) {
        List<DungeonEditorMapSnapshot.Boundary> result = new ArrayList<>();
        for (src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Boundary boundary
                : boundaries == null ? List.<src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Boundary>of() : boundaries) {
            result.add(boundary(boundary));
        }
        return List.copyOf(result);
    }

    private static DungeonEditorMapSnapshot.Boundary boundary(
            src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.@Nullable Boundary boundary
    ) {
        if (boundary == null) {
            return new DungeonEditorMapSnapshot.Boundary(
                    "boundary",
                    1L,
                    "boundary",
                    DungeonEditorValueProjectionServiceAssembly.edge(null),
                    src.domain.dungeon.published.DungeonEditorTopologyElementRef.empty());
        }
        return new DungeonEditorMapSnapshot.Boundary(
                boundary.kind().externalKind(),
                boundary.id(),
                boundary.label(),
                DungeonEditorValueProjectionServiceAssembly.edge(boundary.edge()),
                DungeonEditorValueProjectionServiceAssembly.topologyRef(boundary.topologyRef()));
    }

    private static List<DungeonEditorMapSnapshot.Feature> features(
            List<src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Feature> features
    ) {
        List<DungeonEditorMapSnapshot.Feature> result = new ArrayList<>();
        for (src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Feature feature
                : features == null ? List.<src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Feature>of() : features) {
            result.add(feature(feature));
        }
        return List.copyOf(result);
    }

    private static DungeonEditorMapSnapshot.Feature feature(
            src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.@Nullable Feature feature
    ) {
        if (feature == null) {
            return new DungeonEditorMapSnapshot.Feature(
                    "STAIR",
                    1L,
                    "STAIR",
                    List.of(),
                    "",
                    "",
                    src.domain.dungeon.published.DungeonEditorTopologyElementRef.empty(),
                    null);
        }
        return new DungeonEditorMapSnapshot.Feature(
                feature.kind().name(),
                feature.id(),
                feature.label(),
                DungeonEditorValueProjectionServiceAssembly.cells(feature.cells()),
                feature.description(),
                feature.destinationLabel(),
                DungeonEditorValueProjectionServiceAssembly.topologyRef(feature.topologyRef()),
                feature.anchorEdge() == null
                        ? null
                        : DungeonEditorValueProjectionServiceAssembly.edge(feature.anchorEdge()));
    }

    private static List<src.domain.dungeon.published.DungeonEditorHandleSnapshot> handles(
            List<src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Handle> handles
    ) {
        List<src.domain.dungeon.published.DungeonEditorHandleSnapshot> result = new ArrayList<>();
        for (src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Handle handle
                : handles == null ? List.<src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Handle>of() : handles) {
            result.add(handle(handle));
        }
        return List.copyOf(result);
    }

    private static src.domain.dungeon.published.DungeonEditorHandleSnapshot handle(
            src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.@Nullable Handle handle
    ) {
        if (handle == null) {
            return new src.domain.dungeon.published.DungeonEditorHandleSnapshot(
                    src.domain.dungeon.published.DungeonEditorHandleRef.empty(),
                    "CLUSTER_LABEL",
                    new src.domain.dungeon.published.DungeonCellRef(0, 0, 0));
        }
        return new src.domain.dungeon.published.DungeonEditorHandleSnapshot(
                DungeonEditorValueProjectionServiceAssembly.handleRef(handle.ref()),
                handle.label(),
                DungeonEditorValueProjectionServiceAssembly.cell(handle.cell()));
    }
}
