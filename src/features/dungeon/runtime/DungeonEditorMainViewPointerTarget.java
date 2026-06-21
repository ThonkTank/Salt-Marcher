package src.features.dungeon.runtime;

import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

record DungeonEditorMainViewPointerTarget(
        AuthoredTargetKind targetKind,
        DungeonTopologyElementKind elementKind,
        long ownerId,
        long clusterId,
        DungeonTopologyRef topologyRef,
        String labelKind,
        DungeonEditorWorkspaceValues.HandleRef handleRef,
        DungeonEditorWorkspaceValues.BoundaryKind boundaryKind,
        String boundaryKey,
        DungeonEditorWorkspaceValues.Cell boundaryStart,
        DungeonEditorWorkspaceValues.Cell boundaryEnd
) {
    private static final String EMPTY_LABEL_KIND = "EMPTY";

    DungeonEditorMainViewPointerTarget {
        targetKind = targetKind == null ? AuthoredTargetKind.EMPTY : targetKind;
        elementKind = elementKind == null ? DungeonTopologyElementKind.EMPTY : elementKind;
        ownerId = Math.max(0L, ownerId);
        clusterId = Math.max(0L, clusterId);
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        labelKind = labelKind == null || labelKind.isBlank() ? EMPTY_LABEL_KIND : labelKind.trim();
        handleRef = handleRef == null ? DungeonEditorWorkspaceValues.HandleRef.empty() : handleRef;
        boundaryKind = boundaryKind == null
                ? DungeonEditorWorkspaceValues.BoundaryKind.defaultKind()
                : boundaryKind;
        boundaryKey = boundaryKey == null ? "" : boundaryKey.strip();
        boundaryStart = boundaryStart == null ? DungeonEditorWorkspaceValues.Cell.empty() : boundaryStart;
        boundaryEnd = boundaryEnd == null ? DungeonEditorWorkspaceValues.Cell.empty() : boundaryEnd;
    }

    static DungeonEditorMainViewPointerTarget empty() {
        return new DungeonEditorMainViewPointerTarget(
                AuthoredTargetKind.EMPTY,
                DungeonTopologyElementKind.EMPTY,
                0L,
                0L,
                DungeonTopologyRef.empty(),
                EMPTY_LABEL_KIND,
                DungeonEditorWorkspaceValues.HandleRef.empty(),
                DungeonEditorWorkspaceValues.BoundaryKind.defaultKind(),
                "",
                DungeonEditorWorkspaceValues.Cell.empty(),
                DungeonEditorWorkspaceValues.Cell.empty());
    }

    static DungeonEditorMainViewPointerTarget cell(
            DungeonTopologyElementKind elementKind,
            long ownerId,
            long clusterId,
            DungeonTopologyRef topologyRef
    ) {
        return new DungeonEditorMainViewPointerTarget(
                authoredCellTargetKind(elementKind),
                elementKind,
                ownerId,
                clusterId,
                topologyRef,
                EMPTY_LABEL_KIND,
                DungeonEditorWorkspaceValues.HandleRef.empty(),
                DungeonEditorWorkspaceValues.BoundaryKind.defaultKind(),
                "",
                DungeonEditorWorkspaceValues.Cell.empty(),
                DungeonEditorWorkspaceValues.Cell.empty());
    }

    static DungeonEditorMainViewPointerTarget label(
            long ownerId,
            long clusterId,
            DungeonTopologyRef topologyRef,
            String labelKind
    ) {
        DungeonTopologyRef safeTopologyRef = topologyRef == null
                ? DungeonTopologyRef.empty()
                : topologyRef;
        String safeLabelKind = labelKind == null || labelKind.isBlank() ? EMPTY_LABEL_KIND : labelKind.trim();
        return new DungeonEditorMainViewPointerTarget(
                authoredLabelTargetKind(safeLabelKind),
                safeTopologyRef.kind(),
                ownerId,
                clusterId,
                safeTopologyRef,
                safeLabelKind,
                DungeonEditorWorkspaceValues.HandleRef.empty(),
                DungeonEditorWorkspaceValues.BoundaryKind.defaultKind(),
                "",
                DungeonEditorWorkspaceValues.Cell.empty(),
                DungeonEditorWorkspaceValues.Cell.empty());
    }

    static DungeonEditorMainViewPointerTarget graphNode(
            long ownerId,
            long clusterId,
            DungeonTopologyRef topologyRef
    ) {
        DungeonTopologyRef safeTopologyRef = topologyRef == null
                ? DungeonTopologyRef.empty()
                : topologyRef;
        return new DungeonEditorMainViewPointerTarget(
                AuthoredTargetKind.GRAPH_NODE,
                safeTopologyRef.kind(),
                ownerId,
                clusterId,
                safeTopologyRef,
                EMPTY_LABEL_KIND,
                DungeonEditorWorkspaceValues.HandleRef.empty(),
                DungeonEditorWorkspaceValues.BoundaryKind.defaultKind(),
                "",
                DungeonEditorWorkspaceValues.Cell.empty(),
                DungeonEditorWorkspaceValues.Cell.empty());
    }

    static DungeonEditorMainViewPointerTarget handle(DungeonEditorWorkspaceValues.HandleRef handleRef) {
        DungeonEditorWorkspaceValues.HandleRef safeHandle = handleRef == null
                ? DungeonEditorWorkspaceValues.HandleRef.empty()
                : handleRef;
        return new DungeonEditorMainViewPointerTarget(
                AuthoredTargetKind.HANDLE,
                safeHandle.topologyRef().kind(),
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.topologyRef(),
                EMPTY_LABEL_KIND,
                safeHandle,
                DungeonEditorWorkspaceValues.BoundaryKind.defaultKind(),
                "",
                DungeonEditorWorkspaceValues.Cell.empty(),
                DungeonEditorWorkspaceValues.Cell.empty());
    }

    static DungeonEditorMainViewPointerTarget boundary(
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
                AuthoredTargetKind.BOUNDARY,
                safeTopologyRef.kind(),
                ownerId,
                0L,
                safeTopologyRef,
                EMPTY_LABEL_KIND,
                DungeonEditorWorkspaceValues.HandleRef.empty(),
                boundaryKind,
                key,
                start,
                end);
    }

    boolean boundaryPresent() {
        return ownerId > 0L
                || !topologyRef.equals(DungeonTopologyRef.empty())
                || !boundaryKey.isBlank();
    }

    private static AuthoredTargetKind authoredCellTargetKind(DungeonTopologyElementKind elementKind) {
        if (elementKind == DungeonTopologyElementKind.ROOM) {
            return AuthoredTargetKind.ROOM_FLOOR;
        }
        if (elementKind == DungeonTopologyElementKind.CORRIDOR) {
            return AuthoredTargetKind.CORRIDOR;
        }
        if (elementKind == DungeonTopologyElementKind.STAIR) {
            return AuthoredTargetKind.STAIR;
        }
        if (elementKind == DungeonTopologyElementKind.TRANSITION) {
            return AuthoredTargetKind.TRANSITION;
        }
        if (elementKind == DungeonTopologyElementKind.FEATURE_MARKER) {
            return AuthoredTargetKind.FEATURE_MARKER;
        }
        return AuthoredTargetKind.EMPTY;
    }

    private static AuthoredTargetKind authoredLabelTargetKind(String labelKind) {
        return switch (labelKind) {
            case "ROOM_LABEL" -> AuthoredTargetKind.ROOM_LABEL;
            case "CLUSTER_LABEL" -> AuthoredTargetKind.CLUSTER_LABEL;
            case "FEATURE_LABEL" -> AuthoredTargetKind.FEATURE_LABEL;
            default -> AuthoredTargetKind.EMPTY;
        };
    }

    enum AuthoredTargetKind {
        EMPTY(AuthoredTargetCategory.EMPTY),
        ROOM_FLOOR(AuthoredTargetCategory.SIMPLE),
        ROOM_LABEL(AuthoredTargetCategory.LABEL),
        CLUSTER_LABEL(AuthoredTargetCategory.LABEL),
        FEATURE_LABEL(AuthoredTargetCategory.LABEL),
        CORRIDOR(AuthoredTargetCategory.SIMPLE),
        STAIR(AuthoredTargetCategory.SIMPLE),
        TRANSITION(AuthoredTargetCategory.SIMPLE),
        FEATURE_MARKER(AuthoredTargetCategory.SIMPLE),
        GRAPH_NODE(AuthoredTargetCategory.SIMPLE),
        HANDLE(AuthoredTargetCategory.HANDLE),
        BOUNDARY(AuthoredTargetCategory.BOUNDARY);

        private final AuthoredTargetCategory category;

        AuthoredTargetKind(AuthoredTargetCategory category) {
            this.category = category;
        }

        AuthoredTargetCategory category() {
            return category;
        }

        boolean clusterLabel() {
            return this == CLUSTER_LABEL;
        }
    }

    enum AuthoredTargetCategory {
        EMPTY,
        SIMPLE,
        LABEL,
        HANDLE,
        BOUNDARY
    }
}
