package features.dungeon.domain.core.structure.corridor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.component.CorridorAnchorRef;
import features.dungeon.domain.core.component.CorridorWaypoint;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;

final class CorridorAnchorDependencyUpdate {
    private static final CorridorReplacementRouteValidation REPLACEMENT_ROUTE_VALIDATION =
            new CorridorReplacementRouteValidation();

    DependencyUpdateResult rerouteDependents(
            DungeonMap currentMap,
            DungeonMap sourceMap,
            List<Corridor> snappedCorridors,
            Map<CorridorNetwork.AnchorKey, AnchorMovement> movedAnchors,
            Set<Long> movedCorridorIds
    ) {
        if (movedAnchors.isEmpty()) {
            return DependencyUpdateResult.success(snappedCorridors);
        }
        CorridorNetwork network = new CorridorNetwork(snappedCorridors);
        Set<Long> impactedCorridorIds = network.corridorsReferencing(movedAnchors.keySet());
        Set<Long> dependentCorridorIds = dependentCorridorIds(impactedCorridorIds, movedCorridorIds);
        if (dependentCorridorIds.isEmpty()) {
            return DependencyUpdateResult.success(snappedCorridors);
        }
        List<Corridor> rerouted = new ArrayList<>();
        for (Corridor corridor : snappedCorridors) {
            if (corridor == null || !dependentCorridorIds.contains(corridor.corridorId())) {
                rerouted.add(corridor);
                continue;
            }
            rerouted.add(reroutedDependent(sourceMap, currentMap, corridor, movedAnchors));
        }
        List<Corridor> result = List.copyOf(rerouted);
        return hasValidReplacementRoutes(currentMap, result, dependentCorridorIds)
                ? DependencyUpdateResult.success(result)
                : DependencyUpdateResult.rejected();
    }

    private static Set<Long> dependentCorridorIds(Set<Long> impactedCorridorIds, Set<Long> movedCorridorIds) {
        Set<Long> result = new LinkedHashSet<>();
        for (Long corridorId : impactedCorridorIds == null ? Set.<Long>of() : impactedCorridorIds) {
            if (corridorId != null && (movedCorridorIds == null || !movedCorridorIds.contains(corridorId))) {
                result.add(corridorId);
            }
        }
        return Set.copyOf(result);
    }

    private static boolean hasValidReplacementRoutes(
            DungeonMap sourceMap,
            List<Corridor> candidateCorridors,
            Set<Long> impactedCorridorIds
    ) {
        CorridorReplacementRouteValidation.ValidationContext validationContext =
                REPLACEMENT_ROUTE_VALIDATION.validationContext(sourceMap, candidateCorridors);
        for (Corridor corridor : candidateCorridors) {
            if (corridor != null
                    && impactedCorridorIds.contains(corridor.corridorId())
                    && !validationContext.hasValidReplacementRoute(corridor)) {
                return false;
            }
        }
        return true;
    }

    private static Corridor reroutedDependent(
            DungeonMap sourceMap,
            DungeonMap currentMap,
            Corridor corridor,
            Map<CorridorNetwork.AnchorKey, AnchorMovement> movedAnchors
    ) {
        if (corridor.stateBindings().waypoints().isEmpty() || corridor.stateBindings().anchorRefs().isEmpty()) {
            return corridor;
        }
        Map<CorridorNetwork.AnchorKey, AnchorMovement> referencedAnchorMoves = referencedAnchorMoves(corridor, movedAnchors);
        if (referencedAnchorMoves.isEmpty()) {
            return corridor;
        }
        List<CorridorWaypoint> updatedWaypoints = new ArrayList<>();
        boolean changed = false;
        for (CorridorWaypoint waypoint : corridor.stateBindings().waypoints()) {
            CorridorWaypoint updated = reroutedWaypoint(sourceMap, currentMap, waypoint, referencedAnchorMoves);
            updatedWaypoints.add(updated);
            changed = changed || !updated.equals(waypoint);
        }
        return changed
                ? corridor.withStateBindings(corridor.stateBindings().replaceWaypoints(updatedWaypoints))
                : corridor;
    }

    private static CorridorWaypoint reroutedWaypoint(
            DungeonMap sourceMap,
            DungeonMap currentMap,
            CorridorWaypoint waypoint,
            Map<CorridorNetwork.AnchorKey, AnchorMovement> referencedAnchorMoves
    ) {
        Cell sourceCenter = CorridorMapLookup.clusterCenterOrOrigin(
                sourceMap,
                waypoint.clusterId(),
                waypoint.level());
        Cell currentCenter = CorridorMapLookup.clusterCenterOrOrigin(
                currentMap,
                waypoint.clusterId(),
                waypoint.level());
        Cell absoluteCell = waypoint.absoluteCell(sourceCenter);
        for (AnchorMovement movement : referencedAnchorMoves.values()) {
            if (movement.previousCell().equals(absoluteCell) && !movement.nextCell().equals(absoluteCell)) {
                Cell nextCell = movement.nextCell();
                return new CorridorWaypoint(
                        waypoint.clusterId(),
                        new Cell(
                                nextCell.q() - currentCenter.q(),
                                nextCell.r() - currentCenter.r(),
                                nextCell.level()),
                        nextCell.level());
            }
        }
        return waypoint;
    }

    private static Map<CorridorNetwork.AnchorKey, AnchorMovement> referencedAnchorMoves(
            Corridor corridor,
            Map<CorridorNetwork.AnchorKey, AnchorMovement> movedAnchors
    ) {
        Map<CorridorNetwork.AnchorKey, AnchorMovement> result = new LinkedHashMap<>();
        for (CorridorAnchorRef ref : corridor.stateBindings().anchorRefs()) {
            if (ref == null || !ref.present()) {
                continue;
            }
            CorridorNetwork.AnchorKey key = CorridorNetwork.AnchorKey.from(ref);
            AnchorMovement moved = movedAnchors.get(key);
            if (moved != null) {
                result.put(key, moved);
            }
        }
        return Map.copyOf(result);
    }

    record AnchorMovement(Cell previousCell, Cell nextCell) {
    }

    record DependencyUpdateResult(List<Corridor> corridors, boolean accepted) {
        static DependencyUpdateResult success(List<Corridor> corridors) {
            return new DependencyUpdateResult(corridors == null ? List.of() : List.copyOf(corridors), true);
        }

        static DependencyUpdateResult rejected() {
            return new DependencyUpdateResult(List.of(), false);
        }
    }
}
