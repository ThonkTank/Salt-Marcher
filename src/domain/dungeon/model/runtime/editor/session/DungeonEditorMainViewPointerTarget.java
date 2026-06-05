package src.domain.dungeon.model.runtime.editor.session;

import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;

public record DungeonEditorMainViewPointerTarget(
        int targetCode,
        DungeonTopologyElementKind elementKind,
        long ownerId,
        long clusterId,
        DungeonTopologyRef topologyRef,
        DungeonEditorWorkspaceValues.HandleRef handleRef,
        DungeonEditorWorkspaceValues.BoundaryKind boundaryKind,
        String boundaryKey,
        DungeonEditorWorkspaceValues.Cell boundaryStart,
        DungeonEditorWorkspaceValues.Cell boundaryEnd
) {
    public static final int NO_TARGET = 0;
    public static final int CELL_TARGET = 1;
    public static final int LABEL_TARGET = 2;
    public static final int GRAPH_NODE_TARGET = 3;
    public static final int HANDLE_TARGET = 4;
    public static final int BOUNDARY_TARGET = 5;

    public DungeonEditorMainViewPointerTarget {
        targetCode = normalizeTargetCode(targetCode);
        elementKind = elementKind == null ? DungeonTopologyElementKind.EMPTY : elementKind;
        ownerId = Math.max(0L, ownerId);
        clusterId = Math.max(0L, clusterId);
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        handleRef = handleRef == null ? DungeonEditorWorkspaceValues.HandleRef.empty() : handleRef;
        boundaryKind = boundaryKind == null
                ? DungeonEditorWorkspaceValues.BoundaryKind.defaultKind()
                : boundaryKind;
        boundaryKey = boundaryKey == null ? "" : boundaryKey.strip();
        boundaryStart = boundaryStart == null ? DungeonEditorWorkspaceValues.Cell.empty() : boundaryStart;
        boundaryEnd = boundaryEnd == null ? DungeonEditorWorkspaceValues.Cell.empty() : boundaryEnd;
    }

    public static DungeonEditorMainViewPointerTarget empty() {
        return new DungeonEditorMainViewPointerTarget(
                NO_TARGET,
                DungeonTopologyElementKind.EMPTY,
                0L,
                0L,
                DungeonTopologyRef.empty(),
                DungeonEditorWorkspaceValues.HandleRef.empty(),
                DungeonEditorWorkspaceValues.BoundaryKind.defaultKind(),
                "",
                DungeonEditorWorkspaceValues.Cell.empty(),
                DungeonEditorWorkspaceValues.Cell.empty());
    }

    public static DungeonEditorMainViewPointerTarget cell(
            DungeonTopologyElementKind elementKind,
            long ownerId,
            long clusterId,
            DungeonTopologyRef topologyRef
    ) {
        return new DungeonEditorMainViewPointerTarget(
                CELL_TARGET,
                elementKind,
                ownerId,
                clusterId,
                topologyRef,
                DungeonEditorWorkspaceValues.HandleRef.empty(),
                DungeonEditorWorkspaceValues.BoundaryKind.defaultKind(),
                "",
                DungeonEditorWorkspaceValues.Cell.empty(),
                DungeonEditorWorkspaceValues.Cell.empty());
    }

    public static DungeonEditorMainViewPointerTarget label(
            long ownerId,
            long clusterId,
            DungeonTopologyRef topologyRef
    ) {
        DungeonTopologyRef safeTopologyRef = topologyRef == null
                ? DungeonTopologyRef.empty()
                : topologyRef;
        return new DungeonEditorMainViewPointerTarget(
                LABEL_TARGET,
                safeTopologyRef.kind(),
                ownerId,
                clusterId,
                safeTopologyRef,
                DungeonEditorWorkspaceValues.HandleRef.empty(),
                DungeonEditorWorkspaceValues.BoundaryKind.defaultKind(),
                "",
                DungeonEditorWorkspaceValues.Cell.empty(),
                DungeonEditorWorkspaceValues.Cell.empty());
    }

    public static DungeonEditorMainViewPointerTarget graphNode(
            long ownerId,
            long clusterId,
            DungeonTopologyRef topologyRef
    ) {
        DungeonTopologyRef safeTopologyRef = topologyRef == null
                ? DungeonTopologyRef.empty()
                : topologyRef;
        return new DungeonEditorMainViewPointerTarget(
                GRAPH_NODE_TARGET,
                safeTopologyRef.kind(),
                ownerId,
                clusterId,
                safeTopologyRef,
                DungeonEditorWorkspaceValues.HandleRef.empty(),
                DungeonEditorWorkspaceValues.BoundaryKind.defaultKind(),
                "",
                DungeonEditorWorkspaceValues.Cell.empty(),
                DungeonEditorWorkspaceValues.Cell.empty());
    }

    public static DungeonEditorMainViewPointerTarget handle(DungeonEditorWorkspaceValues.HandleRef handleRef) {
        DungeonEditorWorkspaceValues.HandleRef safeHandle = handleRef == null
                ? DungeonEditorWorkspaceValues.HandleRef.empty()
                : handleRef;
        return new DungeonEditorMainViewPointerTarget(
                HANDLE_TARGET,
                safeHandle.topologyRef().kind(),
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.topologyRef(),
                safeHandle,
                DungeonEditorWorkspaceValues.BoundaryKind.defaultKind(),
                "",
                DungeonEditorWorkspaceValues.Cell.empty(),
                DungeonEditorWorkspaceValues.Cell.empty());
    }

    public static DungeonEditorMainViewPointerTarget boundary(
            DungeonEditorWorkspaceValues.BoundaryKind boundaryKind,
            String key,
            long ownerId,
            DungeonTopologyRef topologyRef,
            DungeonEditorWorkspaceValues.Cell start,
            DungeonEditorWorkspaceValues.Cell end
    ) {
        DungeonTopologyRef safeTopologyRef = topologyRef == null
                ? DungeonTopologyRef.empty()
                : topologyRef;
        return new DungeonEditorMainViewPointerTarget(
                BOUNDARY_TARGET,
                safeTopologyRef.kind(),
                ownerId,
                0L,
                safeTopologyRef,
                DungeonEditorWorkspaceValues.HandleRef.empty(),
                boundaryKind,
                key,
                start,
                end);
    }

    public boolean boundaryPresent() {
        return ownerId > 0L
                || !topologyRef.equals(DungeonTopologyRef.empty())
                || !boundaryKey.isBlank();
    }

    private static int normalizeTargetCode(int targetCode) {
        return switch (targetCode) {
            case CELL_TARGET, LABEL_TARGET, GRAPH_NODE_TARGET, HANDLE_TARGET, BOUNDARY_TARGET -> targetCode;
            default -> NO_TARGET;
        };
    }

}
