package src.features.dungeon.runtime;

import java.util.List;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorPointerInputTranslator {

    private DungeonEditorPointerInputTranslator() {
    }

    static DungeonEditorMainViewInput mainViewInput(
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        PointerSample safeSample = sample == null
                ? new PointerSample(0.0, 0.0, false, false, DungeonEditorRuntimePointerTarget.empty())
                : sample;
        TransitionDestination safeDestination = transitionDestination == null
                ? TransitionDestination.empty()
                : transitionDestination;
        return new DungeonEditorMainViewInput(
                safeSample.sceneX(),
                safeSample.sceneY(),
                safeSample.primaryButtonDown(),
                safeSample.secondaryButtonDown(),
                wallSingleClickMode,
                plainPointerTarget(safeSample.target()),
                safeDestination);
    }

    static DungeonEditorMainViewInput mainViewInput(
            String toolKey,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        PointerSample safeSample = sample == null
                ? new PointerSample(0.0, 0.0, false, false, DungeonEditorRuntimePointerTarget.empty())
                : sample;
        DungeonEditorTool selectedTool = DungeonEditorRuntimeEnumTranslator.editorTool(toolKey);
        TransitionDestination safeDestination = transitionDestination == null
                ? TransitionDestination.empty()
                : transitionDestination;
        return mainViewInput(safeSample, wallSingleClickMode, selectedTool == DungeonEditorTool.DOOR_DELETE,
                safeDestination);
    }

    private static DungeonEditorMainViewInput mainViewInput(
            PointerSample sample,
            boolean wallSingleClickMode,
            boolean doorDeleteSelected,
            TransitionDestination transitionDestination
    ) {
        return new DungeonEditorMainViewInput(
                sample.sceneX(),
                sample.sceneY(),
                sample.primaryButtonDown(),
                sample.secondaryButtonDown(),
                wallSingleClickMode,
                pointerTarget(sample.target(), doorDeleteSelected),
                transitionDestination);
    }

    private static DungeonEditorMainViewPointerTarget pointerTarget(
            DungeonEditorRuntimePointerTarget target,
            boolean doorDeleteSelected
    ) {
        DungeonEditorRuntimePointerTarget safeTarget = target == null
                ? DungeonEditorRuntimePointerTarget.empty()
                : target;
        DungeonEditorMainViewPointerTarget doorDeleteTarget = doorDeleteBoundaryTarget(safeTarget, doorDeleteSelected);
        return doorDeleteTarget == null ? plainPointerTarget(safeTarget) : doorDeleteTarget;
    }

    private static DungeonEditorMainViewPointerTarget plainPointerTarget(DungeonEditorRuntimePointerTarget target) {
        DungeonEditorRuntimePointerTarget safeTarget = target == null
                ? DungeonEditorRuntimePointerTarget.empty()
                : target;
        return switch (safeTarget.targetKind()) {
            case CELL -> DungeonEditorMainViewPointerTarget.cell(
                    safeTarget.topologyElementKind(),
                    safeTarget.ownerId(),
                    safeTarget.clusterId(),
                    safeTarget.topologyRef());
            case LABEL -> DungeonEditorMainViewPointerTarget.label(
                    safeTarget.ownerId(),
                    safeTarget.clusterId(),
                    safeTarget.topologyRef(),
                    safeTarget.labelKind().legacyName());
            case GRAPH_NODE -> DungeonEditorMainViewPointerTarget.graphNode(
                    safeTarget.ownerId(),
                    safeTarget.clusterId(),
                    safeTarget.topologyRef());
            case HANDLE -> DungeonEditorMainViewPointerTarget.handle(
                    toRuntimeHandleRef(safeTarget.handleRef()));
            case BOUNDARY -> boundaryTarget(safeTarget.boundary());
            default -> DungeonEditorMainViewPointerTarget.empty();
        };
    }

    private static DungeonEditorMainViewPointerTarget doorDeleteBoundaryTarget(
            DungeonEditorRuntimePointerTarget target,
            boolean doorDeleteSelected
    ) {
        DungeonEditorRuntimePointerTarget safeTarget = target == null
                ? DungeonEditorRuntimePointerTarget.empty()
                : target;
        DungeonEditorWorkspaceValues.HandleRef handle = toRuntimeHandleRef(safeTarget.handleRef());
        if (!doorDeleteSelected
                || !safeTarget.isHandleTarget()
                || !DungeonEditorMainViewInteractionValues.handleKind(
                        handle,
                        DungeonEditorMainViewInteractionValues.DOOR_KIND)
                || !handle.hasSourceEdge()) {
            return null;
        }
        return DungeonEditorMainViewPointerTarget.boundary(
                DungeonEditorWorkspaceValues.BoundaryKind.DOOR,
                "",
                handle.ownerId(),
                handle.topologyRef(),
                DungeonEditorRuntimeInputValues.cell(
                        handle.sourceEdge().from().q(),
                        handle.sourceEdge().from().r(),
                        handle.sourceEdge().from().level()),
                DungeonEditorRuntimeInputValues.cell(
                        handle.sourceEdge().to().q(),
                        handle.sourceEdge().to().r(),
                        handle.sourceEdge().to().level()));
    }

    private static DungeonEditorWorkspaceValues.HandleRef toRuntimeHandleRef(DungeonEditorHandleRef handle) {
        DungeonEditorHandleRef safeHandle = handle == null
                ? DungeonEditorHandleRef.empty()
                : handle;
        DungeonCellRef cell = safeHandle.cell();
        DungeonEdgeRef primarySourceEdge = safeHandle.sourceEdge();
        DungeonEditorWorkspaceValues.Edge runtimeSourceEdge = primarySourceEdge == null
                || primarySourceEdge.from() == null
                || primarySourceEdge.to() == null
                ? null
                : new DungeonEditorWorkspaceValues.Edge(
                        new DungeonEditorWorkspaceValues.Cell(
                                primarySourceEdge.from().q(),
                                primarySourceEdge.from().r(),
                                primarySourceEdge.from().level()),
                        new DungeonEditorWorkspaceValues.Cell(
                                primarySourceEdge.to().q(),
                                primarySourceEdge.to().r(),
                                primarySourceEdge.to().level()));
        List<DungeonEditorWorkspaceValues.Edge> runtimeSourceEdges = safeHandle.sourceEdges().stream()
                .filter(edge -> edge != null && edge.from() != null && edge.to() != null)
                .map(edge -> new DungeonEditorWorkspaceValues.Edge(
                        new DungeonEditorWorkspaceValues.Cell(edge.from().q(), edge.from().r(), edge.from().level()),
                        new DungeonEditorWorkspaceValues.Cell(edge.to().q(), edge.to().r(), edge.to().level())))
                .toList();
        return new DungeonEditorWorkspaceValues.HandleRef(
                DungeonEditorRuntimeEnumTranslator.handleType(safeHandle.kind().name()),
                DungeonEditorRuntimeInputValues.topologyRef(
                        safeHandle.topologyRef().kind().name(),
                        safeHandle.topologyRef().id()),
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.corridorId(),
                safeHandle.roomId(),
                safeHandle.index(),
                new DungeonEditorWorkspaceValues.Cell(cell.q(), cell.r(), cell.level()),
                safeHandle.direction(),
                runtimeSourceEdge,
                runtimeSourceEdges);
    }

    private static DungeonEditorMainViewPointerTarget boundaryTarget(
            DungeonEditorRuntimePointerTarget.BoundaryTarget boundary
    ) {
        DungeonEditorRuntimePointerTarget.BoundaryTarget safeBoundary = boundary == null
                ? DungeonEditorRuntimePointerTarget.BoundaryTarget.empty()
                : boundary;
        return DungeonEditorMainViewPointerTarget.boundary(
                safeBoundary.boundaryKind().workspaceKind(),
                safeBoundary.key(),
                safeBoundary.ownerId(),
                DungeonEditorRuntimeInputValues.topologyRef(
                        safeBoundary.topologyKind().legacyName(),
                        safeBoundary.topologyId()),
                DungeonEditorRuntimeInputValues.cell(
                        safeBoundary.startQ(),
                        safeBoundary.startR(),
                        safeBoundary.startLevel()),
                DungeonEditorRuntimeInputValues.cell(
                        safeBoundary.endQ(),
                        safeBoundary.endR(),
                        safeBoundary.endLevel()));
    }
}
