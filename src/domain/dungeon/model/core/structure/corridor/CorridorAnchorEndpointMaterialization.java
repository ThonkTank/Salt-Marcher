package src.domain.dungeon.model.core.structure.corridor;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.component.CorridorAnchor;
import src.domain.dungeon.model.core.geometry.Cell;

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
                withHostAnchor(normalizedCorridors, host.withBindings(host.bindings().withAnchorBinding(created))),
                created,
                true);
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

    private static @Nullable CorridorAnchor existingAnchor(
            Corridor host,
            long preferredAnchorId,
            Cell anchorCell
    ) {
        for (CorridorAnchor anchor : host.bindings().anchorBindings()) {
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
            for (CorridorAnchor anchor : corridor.bindings().anchorBindings()) {
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
}
