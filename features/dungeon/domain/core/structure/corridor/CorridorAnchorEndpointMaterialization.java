package features.dungeon.domain.core.structure.corridor;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.geometry.Cell;

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
                withHostAnchor(normalizedCorridors, coreHostWithAnchor(host, created)),
                created,
                true);
    }

    public static @Nullable AuthoredEndpointMaterialization materializeAuthored(
            List<Corridor> corridors,
            DungeonCorridorEndpoint endpoint,
            long preferredAnchorId,
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
                preferredAnchorId,
                hostCells);
        if (materialized == null) {
            return null;
        }
        return new AuthoredEndpointMaterialization(
                materialized.changed() ? materialized.corridors() : corridors,
                materialized.anchor(),
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

    private static Corridor coreHostWithAnchor(Corridor host, CorridorAnchor created) {
        return new Corridor(
                host.corridorId(),
                host.mapId(),
                host.level(),
                new CorridorRoomSet(host.roomIds()),
                host.coreBindings().withAnchorBinding(created));
    }

    public record AuthoredEndpointMaterialization(
            List<Corridor> corridors,
            CorridorAnchor anchor,
            boolean changed
    ) {
        public AuthoredEndpointMaterialization {
            corridors = corridors == null ? List.of() : List.copyOf(corridors);
        }
    }
}
