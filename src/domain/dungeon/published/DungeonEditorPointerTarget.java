package src.domain.dungeon.published;

public record DungeonEditorPointerTarget(
        TargetKind targetKind,
        DungeonTopologyElementKind elementKind,
        long ownerId,
        long clusterId,
        DungeonTopologyElementRef topologyRef,
        DungeonEditorHandleRef handleRef,
        DungeonEditorBoundaryTargetRef boundaryRef
) {
    public DungeonEditorPointerTarget {
        targetKind = targetKind == null ? TargetKind.EMPTY : targetKind;
        elementKind = elementKind == null ? DungeonTopologyElementKind.EMPTY : elementKind;
        ownerId = Math.max(0L, ownerId);
        clusterId = Math.max(0L, clusterId);
        topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        handleRef = handleRef == null ? DungeonEditorHandleRef.empty() : handleRef;
        boundaryRef = boundaryRef == null ? DungeonEditorBoundaryTargetRef.empty() : boundaryRef;
    }

    public static DungeonEditorPointerTarget empty() {
        return new DungeonEditorPointerTarget(
                TargetKind.EMPTY,
                DungeonTopologyElementKind.EMPTY,
                0L,
                0L,
                DungeonTopologyElementRef.empty(),
                DungeonEditorHandleRef.empty(),
                DungeonEditorBoundaryTargetRef.empty());
    }

    public static DungeonEditorPointerTarget cell(
            DungeonTopologyElementKind elementKind,
            long ownerId,
            long clusterId,
            DungeonTopologyElementRef topologyRef
    ) {
        return new DungeonEditorPointerTarget(
                TargetKind.CELL,
                elementKind,
                ownerId,
                clusterId,
                topologyRef,
                DungeonEditorHandleRef.empty(),
                DungeonEditorBoundaryTargetRef.empty());
    }

    public static DungeonEditorPointerTarget label(
            long ownerId,
            long clusterId,
            DungeonTopologyElementRef topologyRef
    ) {
        return new DungeonEditorPointerTarget(
                TargetKind.LABEL,
                topologyRef == null ? DungeonTopologyElementKind.EMPTY : topologyRef.kind(),
                ownerId,
                clusterId,
                topologyRef,
                DungeonEditorHandleRef.empty(),
                DungeonEditorBoundaryTargetRef.empty());
    }

    public static DungeonEditorPointerTarget graphNode(
            long ownerId,
            long clusterId,
            DungeonTopologyElementRef topologyRef
    ) {
        return new DungeonEditorPointerTarget(
                TargetKind.GRAPH_NODE,
                topologyRef == null ? DungeonTopologyElementKind.EMPTY : topologyRef.kind(),
                ownerId,
                clusterId,
                topologyRef,
                DungeonEditorHandleRef.empty(),
                DungeonEditorBoundaryTargetRef.empty());
    }

    public static DungeonEditorPointerTarget handle(DungeonEditorHandleRef handleRef) {
        DungeonEditorHandleRef safeHandle = handleRef == null ? DungeonEditorHandleRef.empty() : handleRef;
        return new DungeonEditorPointerTarget(
                TargetKind.HANDLE,
                safeHandle.topologyRef().kind(),
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.topologyRef(),
                safeHandle,
                DungeonEditorBoundaryTargetRef.empty());
    }

    public static DungeonEditorPointerTarget boundary(DungeonEditorBoundaryTargetRef boundaryRef) {
        DungeonEditorBoundaryTargetRef safeBoundary =
                boundaryRef == null ? DungeonEditorBoundaryTargetRef.empty() : boundaryRef;
        return new DungeonEditorPointerTarget(
                TargetKind.BOUNDARY,
                safeBoundary.topologyRef().kind(),
                safeBoundary.ownerId(),
                0L,
                safeBoundary.topologyRef(),
                DungeonEditorHandleRef.empty(),
                safeBoundary);
    }

    public boolean isEmpty() {
        return targetKind == TargetKind.EMPTY;
    }

    public enum TargetKind {
        EMPTY,
        CELL,
        LABEL,
        GRAPH_NODE,
        HANDLE,
        BOUNDARY
    }
}
