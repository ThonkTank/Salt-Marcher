package src.domain.dungeon.model.editor.model.session.model;

import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.map.model.DungeonTopologyElementKind;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;

public final class DungeonEditorMainViewPointerTarget {
    public static final int NO_TARGET = 0;
    public static final int CELL_TARGET = 1;
    public static final int LABEL_TARGET = 2;
    public static final int GRAPH_NODE_TARGET = 3;
    public static final int HANDLE_TARGET = 4;
    public static final int BOUNDARY_TARGET = 5;

    private final int targetCode;
    private final DungeonTopologyElementKind elementKind;
    private final long ownerId;
    private final long clusterId;
    private final DungeonTopologyRef topologyRef;
    private final DungeonEditorWorkspaceValues.HandleRef handleRef;
    private final DungeonEditorWorkspaceValues.BoundaryKind boundaryKind;
    private final String boundaryKey;
    private final DungeonEditorWorkspaceValues.Cell boundaryStart;
    private final DungeonEditorWorkspaceValues.Cell boundaryEnd;

    private DungeonEditorMainViewPointerTarget(
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
        this.targetCode = normalizeTargetCode(targetCode);
        this.elementKind = elementKind == null ? DungeonTopologyElementKind.EMPTY : elementKind;
        this.ownerId = Math.max(0L, ownerId);
        this.clusterId = Math.max(0L, clusterId);
        this.topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        this.handleRef = handleRef == null ? DungeonEditorWorkspaceValues.HandleRef.empty() : handleRef;
        this.boundaryKind = boundaryKind == null
                ? DungeonEditorWorkspaceValues.BoundaryKind.defaultKind()
                : boundaryKind;
        this.boundaryKey = boundaryKey == null ? "" : boundaryKey.strip();
        this.boundaryStart = boundaryStart == null ? DungeonEditorWorkspaceValues.Cell.empty() : boundaryStart;
        this.boundaryEnd = boundaryEnd == null ? DungeonEditorWorkspaceValues.Cell.empty() : boundaryEnd;
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

    public int targetCode() {
        return targetCode;
    }

    public DungeonTopologyElementKind elementKind() {
        return elementKind;
    }

    public long ownerId() {
        return ownerId;
    }

    public long clusterId() {
        return clusterId;
    }

    public DungeonTopologyRef topologyRef() {
        return topologyRef;
    }

    public DungeonEditorWorkspaceValues.HandleRef handleRef() {
        return handleRef;
    }

    public DungeonEditorWorkspaceValues.BoundaryKind boundaryKind() {
        return boundaryKind;
    }

    public String boundaryKey() {
        return boundaryKey;
    }

    public DungeonEditorWorkspaceValues.Cell boundaryStart() {
        return boundaryStart;
    }

    public DungeonEditorWorkspaceValues.Cell boundaryEnd() {
        return boundaryEnd;
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
