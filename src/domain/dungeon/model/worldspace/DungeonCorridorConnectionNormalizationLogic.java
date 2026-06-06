package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.structure.corridor.CorridorAnchorBinding;
import src.domain.dungeon.model.core.structure.corridor.CorridorHostCells;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;

/**
 * Owns normalized corridor-connection rebuilding for authored mutations.
 */
public final class DungeonCorridorConnectionNormalizationLogic {

    private static final DungeonDerivedStateProjection DERIVED_STATE_PROJECTION = new DungeonDerivedStateProjection();

    public List<DungeonCorridor> normalizeCorridors(DungeonMap dungeonMap, List<DungeonCorridor> source) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        List<DungeonCorridor> snappedCorridors = snapOwnedAnchors(dungeonMap, source);
        return pruneDetachedAnchors(snappedCorridors);
    }

    public List<DungeonCorridor> pruneDetachedAnchors(List<DungeonCorridor> corridors) {
        return DungeonCorridor.fromCoreNetwork(
                corridors,
                DungeonCorridor.coreNetwork(corridors).withoutDetachedAnchors());
    }

    public DungeonMap copyWithConnections(
            DungeonMap dungeonMap,
            List<DungeonCorridor> nextCorridors,
            StairCollection nextStairs,
            TransitionCatalog nextTransitions
    ) {
        List<DungeonCorridor> normalizedCorridors = normalizeCorridors(dungeonMap, nextCorridors);
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

    private List<DungeonCorridor> snapOwnedAnchors(DungeonMap dungeonMap, List<DungeonCorridor> corridors) {
        CorridorHostCells hostCells = new CorridorHostCells(
                DERIVED_STATE_PROJECTION.corridorCellsByCorridor(dungeonMap, corridors));
        List<DungeonCorridor> result = new ArrayList<>();
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            List<CorridorAnchorBinding> snapped = new ArrayList<>();
            for (CorridorAnchorBinding binding : corridor.bindings().anchorBindings()) {
                if (binding != null) {
                    snapped.add(binding.withAbsoluteCell(hostCells.snapToHostCell(
                            binding.hostCorridorId(),
                            binding.absoluteCell())));
                }
            }
            result.add(corridor.withBindings(corridor.bindings().replaceAnchorBindings(snapped)));
        }
        return List.copyOf(result);
    }

}
