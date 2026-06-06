package src.domain.dungeon.model.core.structure.corridor;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.component.CorridorAnchor;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;

public record CorridorAnchorEndpointMaterialization(
        List<Corridor> corridors,
        CorridorAnchor anchor,
        boolean changed
) {

    public CorridorAnchorEndpointMaterialization {
        corridors = normalizedCorridors(corridors);
        Objects.requireNonNull(anchor);
    }

    public static @Nullable CorridorAnchorEndpointMaterialization materialize(
            List<Corridor> corridors,
            long hostCorridorId,
            Cell desiredCell,
            long preferredAnchorId,
            CorridorHostCells hostCells
    ) {
        long normalizedHostId = Math.max(0L, hostCorridorId);
        List<Corridor> normalizedCorridors = normalizedCorridors(corridors);
        Corridor host = hostCorridor(normalizedCorridors, normalizedHostId);
        if (host == null || hostCells == null || hostCells.cellsFor(normalizedHostId).isEmpty()) {
            return null;
        }
        Cell anchorCell = hostCells.snapToHostCell(normalizedHostId, desiredCell);
        CorridorAnchor existing = existingAnchor(host, Math.max(0L, preferredAnchorId), anchorCell);
        if (existing != null) {
            return new CorridorAnchorEndpointMaterialization(normalizedCorridors, existing, false);
        }
        CorridorAnchor created = new CorridorAnchor(nextAnchorId(normalizedCorridors), normalizedHostId, anchorCell);
        return new CorridorAnchorEndpointMaterialization(
                withHostAnchor(normalizedCorridors, host.withBindings(host.coreBindings().withAnchorBinding(created))),
                created,
                true);
    }

    public static @Nullable AuthoredEndpointMaterialization materializeAuthored(
            List<Corridor> corridors,
            DungeonCorridorEndpoint endpoint,
            CorridorHostCells hostCells
    ) {
        Corridor host = hostCorridor(corridors, endpoint.hostCorridorId());
        if (host == null) {
            return null;
        }
        CorridorAnchorEndpointMaterialization materialized = materialize(
                coreCorridors(corridors),
                endpoint.hostCorridorId(),
                endpoint.anchorCell(),
                preferredAnchorId(host, endpoint.topologyRef()),
                hostCells);
        if (materialized == null) {
            return null;
        }
        CorridorAnchorBinding anchorBinding = anchorBinding(
                materialized.anchor(),
                host,
                endpoint.topologyRef());
        return new AuthoredEndpointMaterialization(
                materialized.changed()
                        ? authoredCorridors(corridors, materialized.corridors(), anchorBinding)
                        : corridors,
                anchorBinding,
                materialized.changed());
    }

    @Override
    public List<Corridor> corridors() {
        return List.copyOf(corridors);
    }

    private static List<Corridor> normalizedCorridors(List<Corridor> source) {
        List<Corridor> result = new ArrayList<>();
        for (Corridor corridor : source == null ? List.<Corridor>of() : source) {
            if (corridor != null) {
                result.add(corridor);
            }
        }
        return List.copyOf(result);
    }

    private static @Nullable Corridor hostCorridor(List<Corridor> corridors, long hostCorridorId) {
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            if (corridor != null && corridor.corridorId() == hostCorridorId) {
                return corridor;
            }
        }
        return null;
    }

    private static List<Corridor> coreCorridors(List<Corridor> corridors) {
        List<Corridor> result = new ArrayList<>();
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            if (corridor != null) {
                result.add(new Corridor(
                        corridor.corridorId(),
                        corridor.mapId(),
                        corridor.level(),
                        new CorridorRoomSet(corridor.roomIds()),
                        corridor.coreBindings()));
            }
        }
        return List.copyOf(result);
    }

    private static long preferredAnchorId(Corridor host, DungeonTopologyRef topologyRef) {
        if (topologyRef == null || !topologyRef.present()) {
            return 0L;
        }
        for (CorridorAnchorBinding binding : host.stateBindings().anchorBindings()) {
            if (binding != null && binding.matchesTopologyRef(topologyRef)) {
                return binding.anchorId();
            }
        }
        return 0L;
    }

    private static CorridorAnchorBinding anchorBinding(
            CorridorAnchor anchor,
            Corridor host,
            DungeonTopologyRef requestedTopologyRef
    ) {
        CorridorAnchorBinding existing = existingAnchorBinding(host, anchor.anchorId());
        if (existing != null) {
            return existing;
        }
        DungeonTopologyRef topologyRef = requestedTopologyRef != null && requestedTopologyRef.present()
                ? requestedTopologyRef
                : DungeonTopologyRef.corridorAnchor(anchor.anchorId());
        return new CorridorAnchorBinding(
                anchor.anchorId(),
                anchor.hostCorridorId(),
                anchor.position(),
                topologyRef);
    }

    private static @Nullable CorridorAnchorBinding existingAnchorBinding(
            Corridor host,
            long anchorId
    ) {
        for (CorridorAnchorBinding binding : host.stateBindings().anchorBindings()) {
            if (binding != null && binding.anchorId() == anchorId) {
                return binding;
            }
        }
        return null;
    }

    private static List<Corridor> authoredCorridors(
            List<Corridor> sourceCorridors,
            List<Corridor> coreCorridors,
            CorridorAnchorBinding anchorBinding
    ) {
        List<Corridor> result = new ArrayList<>();
        for (Corridor coreCorridor : coreCorridors == null ? List.<Corridor>of() : coreCorridors) {
            Corridor source = hostCorridor(sourceCorridors, coreCorridor.corridorId());
            if (source != null) {
                CorridorAnchorBinding replacement =
                        coreCorridor.corridorId() == anchorBinding.hostCorridorId() ? anchorBinding : null;
                result.add(Corridor.fromCore(source, coreCorridor, null, replacement));
            }
        }
        return List.copyOf(result);
    }

    private static @Nullable CorridorAnchor existingAnchor(
            Corridor host,
            long preferredAnchorId,
            Cell anchorCell
    ) {
        for (CorridorAnchor anchor : host.coreBindings().anchorBindings()) {
            if (preferredAnchorId > 0L && anchor.anchorId() == preferredAnchorId || anchor.matchesPosition(anchorCell)) {
                return anchor;
            }
        }
        return null;
    }

    private static long nextAnchorId(List<Corridor> corridors) {
        long result = 0L;
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            if (corridor == null) {
                continue;
            }
            for (CorridorAnchor anchor : corridor.coreBindings().anchorBindings()) {
                if (anchor.anchorId() > result) {
                    result = anchor.anchorId();
                }
            }
        }
        return result + 1L;
    }

    private static List<Corridor> withHostAnchor(List<Corridor> corridors, Corridor host) {
        List<Corridor> result = new ArrayList<>();
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            if (corridor != null) {
                result.add(corridor.corridorId() == host.corridorId() ? host : corridor);
            }
        }
        return List.copyOf(result);
    }

    public record AuthoredEndpointMaterialization(
            List<Corridor> corridors,
            CorridorAnchorBinding anchorBinding,
            boolean changed
    ) {
        public AuthoredEndpointMaterialization {
            corridors = corridors == null ? List.of() : List.copyOf(corridors);
        }
    }
}
