package src.domain.dungeon.model.worldspace;


import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.component.CorridorAnchor;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorAnchorEndpointMaterialization;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindings;
import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorEndpoint;
import src.domain.dungeon.model.core.structure.corridor.CorridorHostCells;
import src.domain.dungeon.model.core.structure.corridor.CorridorNetwork;

public record DungeonCorridor(
        long corridorId,
        long mapId,
        int level,
        List<Long> roomIds,
        DungeonCorridorBindings bindings
) {
    public DungeonCorridor {
        Corridor coreCorridor = new Corridor(corridorId, mapId, level, roomIds, coreBindings(bindings));
        corridorId = coreCorridor.corridorId();
        mapId = coreCorridor.mapId();
        roomIds = coreCorridor.roomIds();
        bindings = bindings == null ? DungeonCorridorBindings.empty() : bindings;
    }

    @Override
    public List<Long> roomIds() {
        return List.copyOf(roomIds);
    }

    public boolean isReadable() {
        return toCore().isReadable();
    }

    public DungeonCorridor withBindings(DungeonCorridorBindings nextBindings) {
        return new DungeonCorridor(corridorId, mapId, level, roomIds, nextBindings);
    }

    Corridor toCore() {
        return new Corridor(corridorId, mapId, level, roomIds, bindings.toCore());
    }

    static CorridorNetwork coreNetwork(List<DungeonCorridor> corridors) {
        List<Corridor> result = new ArrayList<>();
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            if (corridor != null) {
                result.add(corridor.toTopologyIdentityCore());
            }
        }
        return new CorridorNetwork(result);
    }

    static List<DungeonCorridor> fromCoreNetwork(List<DungeonCorridor> sources, CorridorNetwork network) {
        List<DungeonCorridor> result = new ArrayList<>();
        for (Corridor coreCorridor : network == null ? List.<Corridor>of() : network.corridors()) {
            DungeonCorridor source = sourceById(sources, coreCorridor.corridorId());
            if (source != null) {
                result.add(fromTopologyIdentityCore(source, coreCorridor));
            }
        }
        return List.copyOf(result);
    }

    static @Nullable AnchorEndpointMaterialization materializeAnchorEndpoint(
            List<DungeonCorridor> corridors,
            DungeonCorridorEndpoint endpoint,
            CorridorHostCells hostCells
    ) {
        DungeonCorridor host = sourceById(corridors, endpoint.hostCorridorId());
        if (host == null) {
            return null;
        }
        CorridorAnchorEndpointMaterialization materialized = CorridorAnchorEndpointMaterialization.materialize(
                coreCorridors(corridors),
                endpoint.hostCorridorId(),
                endpoint.anchorCell(),
                preferredAnchorId(host, endpoint.topologyRef()),
                hostCells);
        if (materialized == null) {
            return null;
        }
        DungeonCorridorAnchorBinding anchorBinding =
                anchorBinding(materialized.anchor(), host, endpoint.topologyRef());
        return new AnchorEndpointMaterialization(
                materialized.changed()
                        ? worldspaceCorridors(corridors, materialized.corridors(), anchorBinding)
                        : corridors,
                anchorBinding,
                materialized.changed());
    }

    static DungeonCorridor fromCore(
            DungeonCorridor source,
            Corridor coreCorridor,
            DungeonCorridorDoorBinding replacementDoor
    ) {
        return fromCore(source, coreCorridor, replacementDoor, null);
    }

    static DungeonCorridor fromCore(
            DungeonCorridor source,
            Corridor coreCorridor,
            DungeonCorridorDoorBinding replacementDoor,
            DungeonCorridorAnchorBinding replacementAnchor
    ) {
        return new DungeonCorridor(
                coreCorridor.corridorId(),
                coreCorridor.mapId(),
                coreCorridor.level(),
                coreCorridor.roomIds(),
                DungeonCorridorBindings.fromCore(
                        source.bindings(),
                        coreCorridor.bindings(),
                        replacementDoor,
                        replacementAnchor));
    }

    private static CorridorBindings coreBindings(DungeonCorridorBindings bindings) {
        return (bindings == null ? DungeonCorridorBindings.empty() : bindings).toCore();
    }

    private Corridor toTopologyIdentityCore() {
        return new Corridor(
                corridorId,
                mapId,
                level,
                roomIds,
                bindings.toTopologyIdentityCore());
    }

    private static DungeonCorridor fromTopologyIdentityCore(DungeonCorridor source, Corridor coreCorridor) {
        return new DungeonCorridor(
                coreCorridor.corridorId(),
                coreCorridor.mapId(),
                coreCorridor.level(),
                coreCorridor.roomIds(),
                DungeonCorridorBindings.fromTopologyIdentityCore(source.bindings(), coreCorridor.bindings()));
    }

    private static List<Corridor> coreCorridors(List<DungeonCorridor> corridors) {
        List<Corridor> result = new ArrayList<>();
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            if (corridor != null) {
                result.add(corridor.toCore());
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
                anchor.position(),
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
            DungeonCorridor source = sourceById(sourceCorridors, coreCorridor.corridorId());
            if (source != null) {
                DungeonCorridorAnchorBinding replacement =
                        coreCorridor.corridorId() == anchorBinding.hostCorridorId() ? anchorBinding : null;
                result.add(fromCore(source, coreCorridor, null, replacement));
            }
        }
        return List.copyOf(result);
    }

    private static DungeonCorridor sourceById(List<DungeonCorridor> sources, long corridorId) {
        for (DungeonCorridor source : sources == null ? List.<DungeonCorridor>of() : sources) {
            if (source != null && source.corridorId() == corridorId) {
                return source;
            }
        }
        return null;
    }

    record AnchorEndpointMaterialization(
            List<DungeonCorridor> corridors,
            DungeonCorridorAnchorBinding anchorBinding,
            boolean changed
    ) {
        AnchorEndpointMaterialization {
            corridors = corridors == null ? List.of() : List.copyOf(corridors);
        }
    }
}
