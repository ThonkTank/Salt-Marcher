package src.domain.dungeoneditor.model.interaction.helper;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryStretchOrientation;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryStretchSession;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryStretchSide;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorBoundaryStretchHelper {
    public @Nullable BoundaryStretchSession start(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection currentSelection
    ) {
        DungeonEditorBoundaryClusterResolutionHelper clusterResolver = new DungeonEditorBoundaryClusterResolutionHelper();
        BoundaryTarget boundaryTarget = input == null ? null : input.boundaryTarget();
        if (input == null || !input.primaryButtonDown() || boundaryTarget == null || !boundaryTarget.present()) {
            return null;
        }
        BoundaryStretchOrientation orientation = BoundaryStretchOrientation.from(boundaryTarget);
        if (orientation == null) {
            return null;
        }
        long clusterId = clusterResolver.resolveBoundaryClusterId(snapshot, boundaryTarget);
        if (!DungeonEditorWorkspaceValues.hasId(clusterId)) {
            return null;
        }
        List<DungeonEditorWorkspaceValues.Edge> sourceEdges =
                resolveBoundaryStretchEdges(snapshot, clusterId, boundaryTarget, orientation);
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

    public List<DungeonEditorWorkspaceValues.Edge> resolveBoundaryStretchEdges(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            BoundaryTarget boundaryTarget,
            BoundaryStretchOrientation orientation
    ) {
        DungeonEditorBoundaryStretchLineCatalogHelper lineCatalog = new DungeonEditorBoundaryStretchLineCatalogHelper();
        if (snapshot == null || !boundaryTarget.present()) {
            return List.of();
        }
        int level = boundaryTarget.start().level();
        Set<DungeonEditorWorkspaceValues.Cell> clusterCells = clusterCells(snapshot, clusterId, level);
        if (clusterCells.isEmpty()) {
            return List.of();
        }
        DungeonEditorWorkspaceValues.Edge clickedEdge = boundaryTarget.edgeRef();
        BoundaryStretchSide stretchSide = outerStretch(clickedEdge, clusterCells);
        if (stretchSide == BoundaryStretchSide.NONE) {
            return List.of();
        }
        Map<Integer, DungeonEditorWorkspaceValues.Edge> edgesByVariable =
                lineCatalog.edgesOnLine(snapshot, clusterCells, clickedEdge, orientation, stretchSide.outer());
        List<DungeonEditorWorkspaceValues.Edge> contiguousEdges =
                contiguousEdges(edgesByVariable, clickedEdge, orientation);
        return contiguousEdges.isEmpty() ? List.of(clickedEdge) : contiguousEdges;
    }

    private DungeonEditorSessionValues.Selection selectionForBoundaryStretch(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection currentSelection,
            long clusterId,
            BoundaryTarget boundaryTarget
    ) {
        if (currentSelection != null && currentSelection.clusterSelection() && currentSelection.clusterId() == clusterId) {
            return currentSelection;
        }
        DungeonEditorWorkspaceValues.Area clusterArea = firstClusterArea(snapshot, clusterId);
        if (clusterArea != null) {
            return new DungeonEditorSessionValues.Selection(
                    clusterArea.topologyRef(),
                    clusterArea.clusterId(),
                    true,
                    DungeonEditorSessionValues.emptyHandleRef());
        }
        return new DungeonEditorSessionValues.Selection(
                new DungeonEditorWorkspaceValues.TopologyElementRef(
                        DungeonEditorMainViewInteractionValues.toTopologyKind(boundaryTarget.topologyRefKind()),
                        boundaryTarget.topologyRefId()),
                clusterId,
                true,
                DungeonEditorSessionValues.emptyHandleRef());
    }

    private DungeonEditorWorkspaceValues.@Nullable Area firstClusterArea(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId
    ) {
        if (snapshot == null || clusterId <= 0L) {
            return null;
        }
        return snapshot.areas().stream()
                .filter(area -> area.kind().isRoom() && area.clusterId() == clusterId)
                .findFirst()
                .orElse(null);
    }

    private BoundaryStretchSide outerStretch(
            DungeonEditorWorkspaceValues.Edge clickedEdge,
            Set<DungeonEditorWorkspaceValues.Cell> clusterCells
    ) {
        DungeonEditorBoundaryStretchLineCatalogHelper lineCatalog = new DungeonEditorBoundaryStretchLineCatalogHelper();
        int clickedTouchCount = lineCatalog.touchingClusterCount(clickedEdge, clusterCells);
        if (clickedTouchCount == 0) {
            return BoundaryStretchSide.NONE;
        }
        return clickedTouchCount == 1 ? BoundaryStretchSide.OUTER : BoundaryStretchSide.INNER;
    }

    private static List<DungeonEditorWorkspaceValues.Edge> contiguousEdges(
            Map<Integer, DungeonEditorWorkspaceValues.Edge> edgesByVariable,
            DungeonEditorWorkspaceValues.Edge clickedEdge,
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
        List<DungeonEditorWorkspaceValues.Edge> result = new ArrayList<>();
        for (int variable = min; variable <= max; variable++) {
            DungeonEditorWorkspaceValues.Edge edge = edgesByVariable.get(variable);
            if (edge != null) {
                result.add(edge);
            }
        }
        return List.copyOf(result);
    }

    private static int variableCoordinate(
            BoundaryStretchOrientation orientation,
            DungeonEditorWorkspaceValues.Edge edge
    ) {
        return orientation == BoundaryStretchOrientation.VERTICAL
                ? Math.min(edge.from().r(), edge.to().r())
                : Math.min(edge.from().q(), edge.to().q());
    }

    private static Set<DungeonEditorWorkspaceValues.Cell> clusterCells(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            int level
    ) {
        if (snapshot == null || !DungeonEditorWorkspaceValues.hasId(clusterId)) {
            return Set.of();
        }
        Set<DungeonEditorWorkspaceValues.Cell> result = new java.util.LinkedHashSet<>();
        for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
            if (!area.kind().isRoom() || area.clusterId() != clusterId) {
                continue;
            }
            for (DungeonEditorWorkspaceValues.Cell cell : area.cells()) {
                if (cell.level() == level) {
                    result.add(cell);
                }
            }
        }
        return Set.copyOf(result);
    }
}
