package src.features.dungeon.runtime;

import src.domain.dungeon.published.DungeonEditorMapHitRef;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonTopologyElementRef;

final class DungeonEditorRuntimePointerTargetFactory {
    private DungeonEditorRuntimePointerTargetFactory() {
    }

    static DungeonEditorRuntimePointerTarget cell(
            String elementKind,
            long ownerId,
            long clusterId,
            DungeonEditorTopologyElementRef topologyRef
    ) {
        return DungeonEditorRuntimePointerTarget.cell(
                DungeonEditorRuntimePointerTarget.ElementKind.fromLegacy(elementKind),
                ownerId,
                clusterId,
                topologyKind(topologyRef),
                DungeonEditorMapHitRef.topologyId(topologyRef));
    }

    static DungeonEditorRuntimePointerTarget label(
            String labelKind,
            long ownerId,
            long clusterId,
            DungeonEditorTopologyElementRef topologyRef
    ) {
        return DungeonEditorRuntimePointerTarget.label(
                DungeonEditorRuntimePointerTarget.LabelKind.fromLegacy(labelKind),
                ownerId,
                clusterId,
                topologyKind(topologyRef),
                DungeonEditorMapHitRef.topologyId(topologyRef));
    }

    static DungeonEditorRuntimePointerTarget label(
            String labelKind,
            long ownerId,
            long clusterId,
            DungeonTopologyElementRef topologyRef
    ) {
        return DungeonEditorRuntimePointerTarget.label(
                DungeonEditorRuntimePointerTarget.LabelKind.fromLegacy(labelKind),
                ownerId,
                clusterId,
                topologyKind(topologyRef),
                DungeonEditorMapHitRef.topologyId(topologyRef));
    }

    static DungeonEditorRuntimePointerTarget graphNode(
            long ownerId,
            long clusterId,
            String topologyKind,
            long topologyId
    ) {
        return DungeonEditorRuntimePointerTarget.graphNode(
                ownerId,
                clusterId,
                DungeonEditorRuntimePointerTarget.TopologyKind.fromLegacy(topologyKind),
                topologyId);
    }

    private static DungeonEditorRuntimePointerTarget.TopologyKind topologyKind(
            DungeonEditorTopologyElementRef topologyRef
    ) {
        return DungeonEditorRuntimePointerTarget.TopologyKind.fromLegacy(
                DungeonEditorMapHitRef.topologyKind(topologyRef));
    }

    private static DungeonEditorRuntimePointerTarget.TopologyKind topologyKind(
            DungeonTopologyElementRef topologyRef
    ) {
        return DungeonEditorRuntimePointerTarget.TopologyKind.fromLegacy(
                DungeonEditorMapHitRef.topologyKind(topologyRef));
    }
}
