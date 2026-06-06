package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorAnchorBinding;
import src.domain.dungeon.model.core.structure.corridor.CorridorHostCells;
import src.domain.dungeon.model.core.structure.corridor.CorridorNetwork;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;

/**
 * Owns normalized corridor-connection rebuilding for authored mutations.
 */
public final class DungeonCorridorConnectionNormalizationLogic {

    private static final DungeonDerivedStateProjection DERIVED_STATE_PROJECTION = new DungeonDerivedStateProjection();

    public List<Corridor> normalizeCorridors(DungeonMap dungeonMap, List<Corridor> source) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        List<Corridor> snappedCorridors = snapOwnedAnchors(dungeonMap, source);
        return pruneDetachedAnchors(snappedCorridors);
    }

    public List<Corridor> pruneDetachedAnchors(List<Corridor> corridors) {
        return CorridorNetwork.fromAuthored(corridors)
                .withoutDetachedAnchors()
                .toAuthored(corridors);
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

    private List<Corridor> snapOwnedAnchors(DungeonMap dungeonMap, List<Corridor> corridors) {
        CorridorHostCells hostCells = new CorridorHostCells(
                DERIVED_STATE_PROJECTION.corridorCellsByCorridor(dungeonMap, corridors));
        List<Corridor> result = new ArrayList<>();
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            List<CorridorAnchorBinding> snapped = new ArrayList<>();
            for (CorridorAnchorBinding binding : corridor.stateBindings().anchorBindings()) {
                if (binding != null) {
                    snapped.add(binding.withAbsoluteCell(hostCells.snapToHostCell(
                            binding.hostCorridorId(),
                            binding.absoluteCell())));
                }
            }
            result.add(corridor.withStateBindings(corridor.stateBindings().replaceAnchorBindings(snapped)));
        }
        return List.copyOf(result);
    }

}
