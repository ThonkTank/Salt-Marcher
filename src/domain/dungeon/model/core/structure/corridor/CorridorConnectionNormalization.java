package src.domain.dungeon.model.core.structure.corridor;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.component.CorridorAnchor;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;

/**
 * Owns normalized corridor-connection rebuilding for authored mutations.
 */
public final class CorridorConnectionNormalization {

    private static final CorridorHostCellQuery HOST_CELL_QUERY = new CorridorHostCellQuery();

    public List<Corridor> normalizeCorridors(DungeonMap dungeonMap, List<Corridor> source) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        List<Corridor> snappedCorridors = snapOwnedAnchors(dungeonMap, source);
        return pruneDetachedAnchors(snappedCorridors);
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
        List<Corridor> normalizedCorridors = normalizeCorridors(dungeonMap, nextCorridors);
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
            for (CorridorAnchor anchor : corridor.stateBindings().anchorBindings()) {
                if (anchor != null) {
                    snapped.add(anchor.withPosition(hostCells.snapToHostCell(
                            anchor.hostCorridorId(),
                            anchor.position())));
                }
            }
            result.add(corridor.withStateBindings(corridor.stateBindings().replaceAnchorBindings(snapped)));
        }
        return List.copyOf(result);
    }
}
