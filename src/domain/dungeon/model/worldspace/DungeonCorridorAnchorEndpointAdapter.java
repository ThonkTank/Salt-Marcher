package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.component.CorridorAnchor;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorAnchorEndpointMaterialization;
import src.domain.dungeon.model.core.structure.corridor.CorridorHostCells;

final class DungeonCorridorAnchorEndpointAdapter {

    @Nullable
    AnchorEndpointResult materialize(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint endpoint,
            CorridorHostCells hostCells
    ) {
        List<DungeonCorridor> sourceCorridors = dungeonMap.connections().corridors();
        DungeonCorridor host = hostCorridor(sourceCorridors, endpoint.hostCorridorId());
        if (host == null) {
            return null;
        }
        CorridorAnchorEndpointMaterialization materialized = CorridorAnchorEndpointMaterialization.materialize(
                coreCorridors(sourceCorridors),
                endpoint.hostCorridorId(),
                endpoint.anchorCell().geometry(),
                preferredAnchorId(host, endpoint.topologyRef()),
                hostCells);
        if (materialized == null) {
            return null;
        }
        DungeonCorridorAnchorBinding anchorBinding =
                anchorBinding(materialized.anchor(), host, endpoint.topologyRef());
        return new AnchorEndpointResult(
                materialized.changed()
                        ? copyWithCorridors(
                                dungeonMap,
                                worldspaceCorridors(sourceCorridors, materialized.corridors(), anchorBinding))
                        : dungeonMap,
                anchorBinding);
    }

    private static @Nullable DungeonCorridor hostCorridor(List<DungeonCorridor> corridors, long hostCorridorId) {
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            if (corridor != null && corridor.corridorId() == hostCorridorId) {
                return corridor;
            }
        }
        return null;
    }

    private static List<Corridor> coreCorridors(List<DungeonCorridor> corridors) {
        List<Corridor> result = new ArrayList<>();
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            if (corridor != null) {
                result.add(DungeonCorridorCoreAdapter.toCore(corridor));
            }
        }
        return List.copyOf(result);
    }

    private static long preferredAnchorId(DungeonCorridor host, DungeonTopologyRef topologyRef) {
        if (topologyRef == null || !topologyRef.present()) {
            return 0L;
        }
        for (DungeonCorridorAnchorBinding binding : host.bindings().anchorBindings()) {
            if (binding != null && binding.matchesTopologyRef(topologyRef)) {
                return binding.anchorId();
            }
        }
        return 0L;
    }

    private static DungeonCorridorAnchorBinding anchorBinding(
            CorridorAnchor anchor,
            DungeonCorridor host,
            DungeonTopologyRef requestedTopologyRef
    ) {
        DungeonCorridorAnchorBinding existing = existingAnchorBinding(host, anchor.anchorId());
        if (existing != null) {
            return existing;
        }
        DungeonTopologyRef topologyRef = requestedTopologyRef != null && requestedTopologyRef.present()
                ? requestedTopologyRef
                : DungeonTopologyRef.corridorAnchor(anchor.anchorId());
        return new DungeonCorridorAnchorBinding(
                anchor.anchorId(),
                anchor.hostCorridorId(),
                DungeonCell.fromGeometry(anchor.position()),
                topologyRef);
    }

    private static @Nullable DungeonCorridorAnchorBinding existingAnchorBinding(
            DungeonCorridor host,
            long anchorId
    ) {
        for (DungeonCorridorAnchorBinding binding : host.bindings().anchorBindings()) {
            if (binding != null && binding.anchorId() == anchorId) {
                return binding;
            }
        }
        return null;
    }

    private static List<DungeonCorridor> worldspaceCorridors(
            List<DungeonCorridor> sourceCorridors,
            List<Corridor> coreCorridors,
            DungeonCorridorAnchorBinding anchorBinding
    ) {
        List<DungeonCorridor> result = new ArrayList<>();
        for (Corridor coreCorridor : coreCorridors == null ? List.<Corridor>of() : coreCorridors) {
            DungeonCorridor source = sourceCorridor(sourceCorridors, coreCorridor.corridorId());
            if (source != null) {
                DungeonCorridorAnchorBinding replacement =
                        coreCorridor.corridorId() == anchorBinding.hostCorridorId() ? anchorBinding : null;
                result.add(DungeonCorridorCoreAdapter.fromCore(source, coreCorridor, null, replacement));
            }
        }
        return List.copyOf(result);
    }

    private static @Nullable DungeonCorridor sourceCorridor(List<DungeonCorridor> sourceCorridors, long corridorId) {
        for (DungeonCorridor corridor : sourceCorridors == null ? List.<DungeonCorridor>of() : sourceCorridors) {
            if (corridor != null && corridor.corridorId() == corridorId) {
                return corridor;
            }
        }
        return null;
    }

    private static DungeonMap copyWithCorridors(DungeonMap dungeonMap, List<DungeonCorridor> nextCorridors) {
        return new DungeonMap(
                dungeonMap.metadata(),
                dungeonMap.topology(),
                dungeonMap.topologyIndex(),
                dungeonMap.rooms(),
                new ConnectionCatalog(
                        nextCorridors,
                        dungeonMap.connections().stairs(),
                        dungeonMap.connections().transitions()),
                dungeonMap.revision() + 1L);
    }

    record AnchorEndpointResult(DungeonMap map, DungeonCorridorAnchorBinding anchorBinding) {
    }
}
