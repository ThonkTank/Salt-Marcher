package src.domain.dungeoneditor.interaction.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.BoundaryStretchOrientation;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.BoundaryStretchSession;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.BoundaryStretchSide;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;

public final class DungeonEditorBoundaryStretchService {
    private final DungeonEditorBoundaryClusterResolver clusterResolver = new DungeonEditorBoundaryClusterResolver();
    private final DungeonEditorBoundaryStretchLineCatalog lineCatalog = new DungeonEditorBoundaryStretchLineCatalog();

    public @Nullable BoundaryStretchSession start(
            PointerState input,
            DungeonSnapshot snapshot,
            DungeonEditorSessionValues.Selection currentSelection
    ) {
        BoundaryTarget boundaryTarget = input == null ? null : input.boundaryTarget();
        if (input == null || !input.primaryButtonDown() || boundaryTarget == null || !boundaryTarget.present()) {
            return null;
        }
        BoundaryStretchOrientation orientation = BoundaryStretchOrientation.from(boundaryTarget);
        if (orientation == null) {
            return null;
        }
        long clusterId = clusterResolver.resolveBoundaryClusterId(snapshot, boundaryTarget);
        if (clusterId <= 0L) {
            return null;
        }
        List<DungeonEdgeRef> sourceEdges = resolveBoundaryStretchEdges(snapshot, clusterId, boundaryTarget, orientation);
        if (sourceEdges.isEmpty()) {
            return null;
        }
        DungeonEditorSessionValues.Selection nextSelection =
                selectionForBoundaryStretch(snapshot, currentSelection, clusterId, boundaryTarget);
        return new BoundaryStretchSession(
                nextSelection,
                clusterId,
                sourceEdges,
                orientation,
                input.q(),
                input.r(),
                input.level(),
                input.q(),
                input.r(),
                true);
    }

    public List<DungeonEdgeRef> resolveBoundaryStretchEdges(
            DungeonSnapshot snapshot,
            long clusterId,
            BoundaryTarget boundaryTarget,
            BoundaryStretchOrientation orientation
    ) {
        if (snapshot == null || snapshot.map() == null || !boundaryTarget.present()) {
            return List.of();
        }
        int level = boundaryTarget.start().level();
        Set<DungeonCellRef> clusterCells = clusterCells(snapshot, clusterId, level);
        if (clusterCells.isEmpty()) {
            return List.of();
        }
        DungeonEdgeRef clickedEdge = boundaryTarget.edgeRef();
        BoundaryStretchSide stretchSide = outerStretch(clickedEdge, clusterCells);
        if (stretchSide == BoundaryStretchSide.NONE) {
            return List.of();
        }
        Map<Integer, DungeonEdgeRef> edgesByVariable =
                lineCatalog.edgesOnLine(snapshot, clusterCells, clickedEdge, orientation, stretchSide.outer());
        List<DungeonEdgeRef> contiguousEdges = contiguousEdges(edgesByVariable, clickedEdge, orientation);
        return contiguousEdges.isEmpty() ? List.of(clickedEdge) : contiguousEdges;
    }

    private DungeonEditorSessionValues.Selection selectionForBoundaryStretch(
            DungeonSnapshot snapshot,
            DungeonEditorSessionValues.Selection currentSelection,
            long clusterId,
            BoundaryTarget boundaryTarget
    ) {
        if (currentSelection != null && currentSelection.clusterSelection() && currentSelection.clusterId() == clusterId) {
            return currentSelection;
        }
        DungeonAreaSnapshot clusterArea = firstClusterArea(snapshot, clusterId);
        if (clusterArea != null) {
            return new DungeonEditorSessionValues.Selection(clusterArea.topologyRef(), clusterArea.clusterId(), true, null);
        }
        return new DungeonEditorSessionValues.Selection(
                new DungeonTopologyElementRef(
                        DungeonEditorMainViewInteractionValues.toPublishedTopologyKind(boundaryTarget.topologyRefKind()),
                        boundaryTarget.topologyRefId()),
                clusterId,
                true,
                null);
    }

    private @Nullable DungeonAreaSnapshot firstClusterArea(DungeonSnapshot snapshot, long clusterId) {
        if (snapshot == null || snapshot.map() == null || clusterId <= 0L) {
            return null;
        }
        return snapshot.map().areas().stream()
                .filter(area -> area.kind() == DungeonAreaKind.ROOM && area.clusterId() == clusterId)
                .findFirst()
                .orElse(null);
    }

    private BoundaryStretchSide outerStretch(DungeonEdgeRef clickedEdge, Set<DungeonCellRef> clusterCells) {
        int clickedTouchCount = lineCatalog.touchingClusterCount(clickedEdge, clusterCells);
        if (clickedTouchCount == 0) {
            return BoundaryStretchSide.NONE;
        }
        return clickedTouchCount == 1 ? BoundaryStretchSide.OUTER : BoundaryStretchSide.INNER;
    }

    private static List<DungeonEdgeRef> contiguousEdges(
            Map<Integer, DungeonEdgeRef> edgesByVariable,
            DungeonEdgeRef clickedEdge,
            BoundaryStretchOrientation orientation
    ) {
        int min = variableCoordinate(orientation, clickedEdge);
        int max = min;
        while (edgesByVariable.containsKey(min - 1)) {
            min--;
        }
        while (edgesByVariable.containsKey(max + 1)) {
            max++;
        }
        List<DungeonEdgeRef> result = new ArrayList<>();
        for (int variable = min; variable <= max; variable++) {
            DungeonEdgeRef edge = edgesByVariable.get(variable);
            if (edge != null) {
                result.add(edge);
            }
        }
        return List.copyOf(result);
    }

    private static int variableCoordinate(BoundaryStretchOrientation orientation, DungeonEdgeRef edge) {
        return orientation == BoundaryStretchOrientation.VERTICAL
                ? Math.min(edge.from().r(), edge.to().r())
                : Math.min(edge.from().q(), edge.to().q());
    }

    private static Set<DungeonCellRef> clusterCells(DungeonSnapshot snapshot, long clusterId, int level) {
        if (snapshot == null || snapshot.map() == null || clusterId <= 0L) {
            return Set.of();
        }
        Set<DungeonCellRef> result = new java.util.LinkedHashSet<>();
        for (DungeonAreaSnapshot area : snapshot.map().areas()) {
            if (area.kind() != DungeonAreaKind.ROOM || area.clusterId() != clusterId) {
                continue;
            }
            for (DungeonCellRef cell : area.cells()) {
                if (cell.level() == level) {
                    result.add(cell);
                }
            }
        }
        return Set.copyOf(result);
    }
}
