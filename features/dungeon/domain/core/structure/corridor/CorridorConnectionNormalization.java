package features.dungeon.domain.core.structure.corridor;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.stair.StairCollection;
import features.dungeon.domain.core.structure.transition.TransitionCatalog;

/**
 * Owns normalized corridor-connection rebuilding for authored mutations.
 */
public final class CorridorConnectionNormalization {

    private static final CorridorHostCellQuery HOST_CELL_QUERY = new CorridorHostCellQuery();

    public List<Corridor> normalizeCorridors(DungeonMap dungeonMap, List<Corridor> source) {
        return normalizeCorridors(dungeonMap, source, true);
    }

    List<Corridor> normalizeCorridors(
            DungeonMap dungeonMap,
            List<Corridor> source,
            boolean snapAnchorsToCurrentHosts
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        List<Corridor> resolvedCorridors = snapAnchorsToCurrentHosts
                ? snapOwnedAnchors(dungeonMap, source)
                : source;
        return pruneDetachedAnchors(resolvedCorridors);
    }

    public List<Corridor> pruneDetachedAnchors(List<Corridor> corridors) {
        return new CorridorNetwork(corridors)
                .withoutDetachedAnchors()
                .corridors();
    }

    public DungeonMap copyWithConnections(
            DungeonMap dungeonMap,
            List<Corridor> nextCorridors,
            StairCollection nextStairs,
            TransitionCatalog nextTransitions
    ) {
        return copyWithConnections(dungeonMap, nextCorridors, nextStairs, nextTransitions, true);
    }

    DungeonMap copyWithConnections(
            DungeonMap dungeonMap,
            List<Corridor> nextCorridors,
            StairCollection nextStairs,
            TransitionCatalog nextTransitions,
            boolean snapAnchorsToCurrentHosts
    ) {
        List<Corridor> normalizedCorridors = normalizeCorridors(
                dungeonMap,
                nextCorridors,
                snapAnchorsToCurrentHosts);
        return new DungeonMap(
                dungeonMap.metadata(),
                dungeonMap.topology(),
                dungeonMap.topologyIndex(),
                dungeonMap.rooms(),
                normalizedCorridors,
                nextStairs,
                nextTransitions,
                dungeonMap.revision() + 1L);
    }

    List<Corridor> snapOwnedAnchors(DungeonMap dungeonMap, List<Corridor> corridors) {
        return snapOwnedAnchors(
                corridors,
                new CorridorHostCells(HOST_CELL_QUERY.cellsByCorridor(dungeonMap, corridors)));
    }

    List<Corridor> snapOwnedAnchors(List<Corridor> corridors, CorridorHostCells hostCells) {
        List<Corridor> result = new ArrayList<>();
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            List<CorridorAnchor> snapped = new ArrayList<>();
            for (CorridorAnchor anchor : corridor.bindings().anchorBindings()) {
                if (anchor != null) {
                    snapped.add(anchor.withPosition(hostCells.snapToHostCell(
                            anchor.hostCorridorId(),
                            anchor.position())));
                }
            }
            result.add(corridor.withBindings(corridor.bindings().replaceAnchorBindings(snapped)));
        }
        return List.copyOf(result);
    }
}
