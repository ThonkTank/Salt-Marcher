package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.structure.corridor.CorridorHostCells;

/**
 * Owns normalized corridor-connection rebuilding for authored mutations.
 */
public final class DungeonCorridorConnectionNormalizationLogic {

    private static final DungeonDerivedStateProjection DERIVED_STATE_PROJECTION = new DungeonDerivedStateProjection();

    public ConnectionCatalog normalizeConnections(DungeonMap dungeonMap, ConnectionCatalog source) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        ConnectionCatalog safeSource = source == null ? ConnectionCatalog.empty() : source;
        List<DungeonCorridor> snappedCorridors = snapOwnedAnchors(dungeonMap, safeSource.corridors());
        List<DungeonCorridor> prunedCorridors = pruneDetachedAnchors(snappedCorridors);
        return new ConnectionCatalog(prunedCorridors, safeSource.stairs(), safeSource.transitions());
    }

    public List<DungeonCorridor> pruneDetachedAnchors(List<DungeonCorridor> corridors) {
        return DungeonCorridor.fromCoreNetwork(
                corridors,
                DungeonCorridor.coreNetwork(corridors).withoutDetachedAnchors());
    }

    public DungeonMap copyWithConnections(DungeonMap dungeonMap, ConnectionCatalog nextConnections) {
        ConnectionCatalog normalized = normalizeConnections(dungeonMap, nextConnections);
        return new DungeonMap(
                dungeonMap.metadata(),
                dungeonMap.topology(),
                dungeonMap.topologyIndex(),
                dungeonMap.rooms(),
                normalized,
                dungeonMap.revision() + 1L);
    }

    private List<DungeonCorridor> snapOwnedAnchors(DungeonMap dungeonMap, List<DungeonCorridor> corridors) {
        CorridorHostCells hostCells = new CorridorHostCells(
                DERIVED_STATE_PROJECTION.corridorCellsByCorridor(dungeonMap, corridors));
        List<DungeonCorridor> result = new ArrayList<>();
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            List<DungeonCorridorAnchorBinding> snapped = new ArrayList<>();
            for (DungeonCorridorAnchorBinding binding : corridor.bindings().anchorBindings()) {
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
