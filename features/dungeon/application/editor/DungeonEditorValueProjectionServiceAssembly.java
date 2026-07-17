package features.dungeon.application.editor;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.api.DungeonEditorViewMode;

final class DungeonEditorValueProjectionServiceAssembly {

    private DungeonEditorValueProjectionServiceAssembly() {
    }

    static features.dungeon.api.DungeonOverlaySettings overlay(
            DungeonEditorSessionValues.@Nullable OverlaySettings overlay
    ) {
        DungeonEditorSessionValues.OverlaySettings safeOverlay = overlay == null
                ? DungeonEditorSessionValues.OverlaySettings.defaults()
                : overlay;
        return new features.dungeon.api.DungeonOverlaySettings(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    static DungeonEditorViewMode viewMode(DungeonEditorSessionValues.@Nullable ViewMode viewMode) {
        return viewMode != null && "GRAPH".equals(viewMode.name())
                ? DungeonEditorViewMode.GRAPH
                : DungeonEditorViewMode.GRID;
    }

    static features.dungeon.api.DungeonEditorHandleRef handleRef(
            features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.HandleRef handleRef
    ) {
        if (handleRef == null) {
            return features.dungeon.api.DungeonEditorHandleRef.empty();
        }
        return new features.dungeon.api.DungeonEditorHandleRef(
                features.dungeon.api.DungeonEditorHandleKind.valueOf(handleRef.kind().name()),
                domainTopologyRef(handleRef.topologyRef()),
                handleRef.ownerId(),
                handleRef.clusterId(),
                handleRef.corridorId(),
                handleRef.roomId(),
                handleRef.index(),
                cell(handleRef.cell()),
                handleRef.direction(),
                handleRef.sourceEdge() == null ? null : edge(handleRef.sourceEdge()),
                edges(handleRef.sourceEdges()));
    }

    private static List<features.dungeon.api.DungeonEdgeRef> edges(
            List<features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Edge> edges
    ) {
        return edges == null
                ? List.of()
                : edges.stream().map(DungeonEditorValueProjectionServiceAssembly::edge).toList();
    }

    static features.dungeon.api.DungeonTopologyElementRef topologyRef(@Nullable DungeonTopologyRef ref) {
        return ref == null
                ? features.dungeon.api.DungeonTopologyElementRef.empty()
                : new features.dungeon.api.DungeonTopologyElementRef(publishedKind(ref.kind()), ref.id());
    }

    static List<features.dungeon.api.DungeonCellRef> cells(
            List<features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Cell> cells
    ) {
        List<features.dungeon.api.DungeonCellRef> result = new ArrayList<>();
        for (features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Cell cell
                : cells == null ? List.<features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Cell>of() : cells) {
            result.add(cell(cell));
        }
        return List.copyOf(result);
    }

    static features.dungeon.api.DungeonCellRef cell(
            features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Cell mapCell
    ) {
        return mapCell == null
                ? new features.dungeon.api.DungeonCellRef(0, 0, 0)
                : new features.dungeon.api.DungeonCellRef(mapCell.q(), mapCell.r(), mapCell.level());
    }

    static features.dungeon.api.DungeonEdgeRef edge(
            features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Edge mapEdge
    ) {
        if (mapEdge == null) {
            return new features.dungeon.api.DungeonEdgeRef(
                    new features.dungeon.api.DungeonCellRef(0, 0, 0),
                    new features.dungeon.api.DungeonCellRef(0, 0, 0));
        }
        return new features.dungeon.api.DungeonEdgeRef(cell(mapEdge.from()), cell(mapEdge.to()));
    }

    private static features.dungeon.api.DungeonTopologyElementRef domainTopologyRef(@Nullable DungeonTopologyRef ref) {
        return ref == null
                ? features.dungeon.api.DungeonTopologyElementRef.empty()
                : new features.dungeon.api.DungeonTopologyElementRef(
                        publishedKind(ref.kind()),
                        ref.id());
    }

    private static features.dungeon.api.DungeonTopologyElementKind publishedKind(
            features.dungeon.domain.core.graph.DungeonTopologyElementKind kind
    ) {
        if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.ROOM) {
            return features.dungeon.api.DungeonTopologyElementKind.ROOM;
        }
        if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.CORRIDOR) {
            return features.dungeon.api.DungeonTopologyElementKind.CORRIDOR;
        }
        if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.CORRIDOR_ANCHOR) {
            return features.dungeon.api.DungeonTopologyElementKind.CORRIDOR_ANCHOR;
        }
        if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.DOOR) {
            return features.dungeon.api.DungeonTopologyElementKind.DOOR;
        }
        if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.WALL) {
            return features.dungeon.api.DungeonTopologyElementKind.WALL;
        }
        if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.STAIR) {
            return features.dungeon.api.DungeonTopologyElementKind.STAIR;
        }
        if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.TRANSITION) {
            return features.dungeon.api.DungeonTopologyElementKind.TRANSITION;
        }
        if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.FEATURE_MARKER) {
            return features.dungeon.api.DungeonTopologyElementKind.FEATURE_MARKER;
        }
        return features.dungeon.api.DungeonTopologyElementKind.EMPTY;
    }
}
