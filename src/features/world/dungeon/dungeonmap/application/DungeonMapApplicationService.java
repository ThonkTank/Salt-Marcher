package features.world.dungeon.dungeonmap.application;

import features.world.dungeon.dungeonmap.api.AssertClusterFloorDeletionAllowedRequest;
import features.world.dungeon.dungeonmap.api.PreviewAddedCorridorRequest;
import features.world.dungeon.dungeonmap.api.PreviewAddedStairRequest;
import features.world.dungeon.dungeonmap.api.PreviewAddedTransitionRequest;
import features.world.dungeon.dungeonmap.api.PreviewMovedClusterRequest;
import features.world.dungeon.dungeonmap.api.PreviewMovedLocalDoorRequest;
import features.world.dungeon.dungeonmap.api.PreviewRemovedCorridorRequest;
import features.world.dungeon.dungeonmap.api.PreviewRemovedStairRequest;
import features.world.dungeon.dungeonmap.api.PreviewRemovedTransitionRequest;
import features.world.dungeon.dungeonmap.api.PreviewReplacedCorridorRequest;
import features.world.dungeon.dungeonmap.api.PreviewReplacedStairRequest;
import features.world.dungeon.dungeonmap.api.PreviewReplacedTransitionRequest;
import features.world.dungeon.dungeonmap.api.ReconcileClusterRewriteRequest;
import features.world.dungeon.dungeonmap.api.RehydrateCorridorRequest;
import features.world.dungeon.dungeonmap.api.ResolveCorridorRequest;
import features.world.dungeon.dungeonmap.api.ValidateClusterRewriteRequest;
import features.world.dungeon.dungeonmap.api.DoorDescription;
import features.world.dungeon.dungeonmap.api.RoomBoundaryDescription;
import features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest;
import features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest;
import features.world.dungeon.dungeonmap.cluster.model.Cluster;
import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.corridor.model.CorridorInput;
import features.world.dungeon.dungeonmap.corridor.model.CorridorResolutionInput;
import features.world.dungeon.dungeonmap.corridor.model.CorridorReconcileInput;
import features.world.dungeon.dungeonmap.model.ClusterRewriteEffects;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.geometry.GridTranslation;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.model.structures.connection.ConnectionEndpoint;
import features.world.dungeon.model.structures.connection.DoorConnectionCarrier;
import features.world.dungeon.model.structures.connection.DungeonConnection;
import features.world.dungeon.model.structures.connection.StairConnectionCarrier;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.model.structures.stair.DungeonStair;
import features.world.dungeon.model.structures.transition.DungeonTransition;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Map-owned workflow seam for corridor resolution plus cluster, stair, and transition preview composition.
 *
 * <p>Cluster and corridor aggregates still own their authored requests and reconciliation behavior. This service owns
 * only the map-external facts required to validate cluster rewrites, guard cross-owner anchors, and compose corridor,
 * cluster, stair, or transition previews from one authoritative loaded map snapshot.</p>
 */
public final class DungeonMapApplicationService {

    public Corridor resolveCorridor(ResolveCorridorRequest request) {
        ResolveCorridorRequest resolvedRequest = Objects.requireNonNull(request, "request");
        DungeonMap layout = resolvedRequest.map();
        CorridorInput input = resolvedRequest.input();
        return Corridor.fromInput(input, corridorResolutionInput(layout, input.levelZ()));
    }

    public Corridor rehydrateCorridor(RehydrateCorridorRequest request) {
        RehydrateCorridorRequest resolvedRequest = Objects.requireNonNull(request, "request");
        CorridorInput input = resolvedRequest.input();
        return Corridor.rehydrated(
                input,
                resolvedRequest.structure(),
                corridorResolutionInput(resolvedRequest.map(), input.levelZ()));
    }

    public DungeonMap previewAddedCorridor(PreviewAddedCorridorRequest request) {
        PreviewAddedCorridorRequest resolvedRequest = Objects.requireNonNull(request, "request");
        ArrayList<Corridor> updatedCorridors = new ArrayList<>(resolvedRequest.map().corridors());
        updatedCorridors.add(resolvedRequest.corridor());
        return withCorridors(resolvedRequest.map(), updatedCorridors);
    }

    public DungeonMap previewReplacedCorridor(PreviewReplacedCorridorRequest request) {
        PreviewReplacedCorridorRequest resolvedRequest = Objects.requireNonNull(request, "request");
        Corridor corridor = resolvedRequest.corridor();
        if (corridor.corridorId() == null) {
            return resolvedRequest.map();
        }
        boolean replaced = false;
        ArrayList<Corridor> updatedCorridors = new ArrayList<>(resolvedRequest.map().corridors().size());
        for (Corridor existing : resolvedRequest.map().corridors()) {
            if (existing != null && Objects.equals(existing.corridorId(), corridor.corridorId())) {
                updatedCorridors.add(corridor);
                replaced = true;
            } else {
                updatedCorridors.add(existing);
            }
        }
        if (!replaced) {
            updatedCorridors.add(corridor);
        }
        return withCorridors(resolvedRequest.map(), updatedCorridors);
    }

    public DungeonMap previewRemovedCorridor(PreviewRemovedCorridorRequest request) {
        PreviewRemovedCorridorRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.corridorId() == null) {
            return resolvedRequest.map();
        }
        List<Corridor> updatedCorridors = resolvedRequest.map().corridors().stream()
                .filter(corridor -> corridor == null || !Objects.equals(corridor.corridorId(), resolvedRequest.corridorId()))
                .toList();
        return updatedCorridors.size() == resolvedRequest.map().corridors().size()
                ? resolvedRequest.map()
                : withCorridors(resolvedRequest.map(), updatedCorridors);
    }

    public DungeonMap previewAddedStair(PreviewAddedStairRequest request) {
        PreviewAddedStairRequest resolvedRequest = Objects.requireNonNull(request, "request");
        ArrayList<DungeonStair> updatedStairs = new ArrayList<>(resolvedRequest.map().stairs());
        updatedStairs.add(resolvedRequest.stair());
        return withStairs(resolvedRequest.map(), updatedStairs);
    }

    public DungeonMap previewReplacedStair(PreviewReplacedStairRequest request) {
        PreviewReplacedStairRequest resolvedRequest = Objects.requireNonNull(request, "request");
        DungeonStair stair = resolvedRequest.stair();
        if (stair.stairId() == null) {
            return resolvedRequest.map();
        }
        boolean replaced = false;
        ArrayList<DungeonStair> updatedStairs = new ArrayList<>(resolvedRequest.map().stairs().size());
        for (DungeonStair existing : resolvedRequest.map().stairs()) {
            if (existing != null && Objects.equals(existing.stairId(), stair.stairId())) {
                updatedStairs.add(stair);
                replaced = true;
            } else {
                updatedStairs.add(existing);
            }
        }
        if (!replaced) {
            updatedStairs.add(stair);
        }
        return withStairs(resolvedRequest.map(), updatedStairs);
    }

    public DungeonMap previewRemovedStair(PreviewRemovedStairRequest request) {
        PreviewRemovedStairRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.stairId() == null) {
            return resolvedRequest.map();
        }
        List<DungeonStair> updatedStairs = resolvedRequest.map().stairs().stream()
                .filter(stair -> stair == null || !Objects.equals(stair.stairId(), resolvedRequest.stairId()))
                .toList();
        return updatedStairs.size() == resolvedRequest.map().stairs().size()
                ? resolvedRequest.map()
                : withStairs(resolvedRequest.map(), updatedStairs);
    }

    public DungeonMap previewAddedTransition(PreviewAddedTransitionRequest request) {
        PreviewAddedTransitionRequest resolvedRequest = Objects.requireNonNull(request, "request");
        ArrayList<DungeonTransition> updatedTransitions = new ArrayList<>(resolvedRequest.map().transitions());
        updatedTransitions.add(resolvedRequest.transition());
        return withTransitions(resolvedRequest.map(), updatedTransitions);
    }

    public DungeonMap previewReplacedTransition(PreviewReplacedTransitionRequest request) {
        PreviewReplacedTransitionRequest resolvedRequest = Objects.requireNonNull(request, "request");
        DungeonTransition transition = resolvedRequest.transition();
        if (transition.transitionId() == null) {
            return resolvedRequest.map();
        }
        boolean replaced = false;
        ArrayList<DungeonTransition> updatedTransitions = new ArrayList<>(resolvedRequest.map().transitions().size());
        for (DungeonTransition existing : resolvedRequest.map().transitions()) {
            if (existing != null && Objects.equals(existing.transitionId(), transition.transitionId())) {
                updatedTransitions.add(transition);
                replaced = true;
            } else {
                updatedTransitions.add(existing);
            }
        }
        if (!replaced) {
            updatedTransitions.add(transition);
        }
        return withTransitions(resolvedRequest.map(), updatedTransitions);
    }

    public DungeonMap previewRemovedTransition(PreviewRemovedTransitionRequest request) {
        PreviewRemovedTransitionRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.transitionId() == null) {
            return resolvedRequest.map();
        }
        List<DungeonTransition> updatedTransitions = resolvedRequest.map().transitions().stream()
                .filter(transition -> transition == null || !Objects.equals(transition.transitionId(), resolvedRequest.transitionId()))
                .toList();
        return updatedTransitions.size() == resolvedRequest.map().transitions().size()
                ? resolvedRequest.map()
                : withTransitions(resolvedRequest.map(), updatedTransitions);
    }

    public void validateClusterRewrite(ValidateClusterRewriteRequest request) {
        ValidateClusterRewriteRequest resolvedRequest = Objects.requireNonNull(request, "request");
        ClusterRewriteRequest rewriteRequest = resolvedRequest.rewriteRequest();
        if (!rewriteRequest.hasChanges()) {
            return;
        }
        Set<Long> affectedRoomIds = rewriteRequest.affectedRoomIds();
        if (affectedRoomIds.isEmpty()) {
            return;
        }
        DungeonMap rewrittenMap = applyClusterRewrite(resolvedRequest.map(), rewriteRequest);
        validateCorridorRewrite(resolvedRequest.map(), rewrittenMap, affectedRoomIds, rewriteRequest.translation());
        validateTransitionRewrite(resolvedRequest.map(), rewrittenMap, affectedRoomIds);
    }

    public ClusterRewriteEffects reconcileClusterRewrite(ReconcileClusterRewriteRequest request) {
        ReconcileClusterRewriteRequest resolvedRequest = Objects.requireNonNull(request, "request");
        ClusterRewriteRequest rewriteRequest = resolvedRequest.rewriteRequest();
        if (!rewriteRequest.hasChanges()) {
            return ClusterRewriteEffects.empty();
        }
        Set<Long> affectedRoomIds = rewriteRequest.affectedRoomIds();
        if (affectedRoomIds.isEmpty()) {
            return ClusterRewriteEffects.empty();
        }
        List<Corridor> reboundCorridors = reboundCorridors(
                resolvedRequest.originalMap(),
                resolvedRequest.persistedRoomMap(),
                affectedRoomIds,
                rewriteRequest.translation());
        Map<Long, DungeonConnection> reboundTransitionConnections = reboundTransitionConnections(
                resolvedRequest.originalMap(),
                resolvedRequest.persistedRoomMap(),
                affectedRoomIds);
        return reboundCorridors.isEmpty() && reboundTransitionConnections.isEmpty()
                ? ClusterRewriteEffects.empty()
                : new ClusterRewriteEffects(reboundCorridors, reboundTransitionConnections);
    }

    public void assertClusterFloorDeletionAllowed(AssertClusterFloorDeletionAllowedRequest request) {
        AssertClusterFloorDeletionAllowedRequest resolvedRequest = Objects.requireNonNull(request, "request");
        Room room = resolvedRequest.room();
        GridArea removedFloorCells = resolvedRequest.removedFloorCells();
        if (room == null || room.roomId() == null || removedFloorCells == null || removedFloorCells.isEmpty()) {
            return;
        }
        DungeonMap layout = resolvedRequest.map();
        int levelZ = resolvedRequest.levelZ();
        for (Corridor corridor : layout.corridors()) {
            if (corridor == null || corridor.levelZ() != levelZ) {
                continue;
            }
            if (corridor.touchesRoomAnchorCells(room.roomId(), removedFloorCells)) {
                throw new IllegalArgumentException("Boden unter einem Corridor-Anker kann nicht entfernt werden.");
            }
        }
        for (DungeonTransition transition : layout.transitionsAtLevel(levelZ)) {
            if (transition != null
                    && transition.transitionId() != null
                    && transition.localConnection() != null
                    && transition.localConnection().cellFootprint(layout).cells().stream()
                    .filter(point -> point != null && point.z() == levelZ)
                    .anyMatch(removedFloorCells.cells()::contains)) {
                throw new IllegalArgumentException("Boden unter einem platzierten Übergang kann nicht entfernt werden.");
            }
        }
        for (DungeonStair stair : layout.stairsAtLevel(levelZ)) {
            if (stair == null || stair.stairId() == null) {
                continue;
            }
            boolean usesRemovedExit = stair.exitsAtLevel(levelZ).stream()
                    .map(features.world.dungeon.model.structures.stair.StairExit::cell)
                    .filter(Objects::nonNull)
                    .anyMatch(removedFloorCells.cells()::contains);
            if (usesRemovedExit) {
                throw new IllegalArgumentException("Boden unter einem Treppenanschluss kann nicht entfernt werden.");
            }
        }
    }

    public DungeonMap previewMovedCluster(PreviewMovedClusterRequest request) {
        PreviewMovedClusterRequest resolvedRequest = Objects.requireNonNull(request, "request");
        return previewMutatedCluster(
                resolvedRequest.map(),
                resolvedRequest.clusterId(),
                new ClusterMutationRequest.Translation(resolvedRequest.translation()));
    }

    public DungeonMap previewMovedLocalDoor(PreviewMovedLocalDoorRequest request) {
        PreviewMovedLocalDoorRequest resolvedRequest = Objects.requireNonNull(request, "request");
        return previewMutatedCluster(
                resolvedRequest.map(),
                resolvedRequest.clusterId(),
                new ClusterMutationRequest.DoorMove(
                        resolvedRequest.levelZ(),
                        resolvedRequest.sourceBoundarySegment(),
                        resolvedRequest.targetBoundarySegment()));
    }

    private CorridorResolutionInput corridorResolutionInput(DungeonMap layout, int levelZ) {
        return new CorridorResolutionInput(
                levelZ,
                blockedRoomCells(layout, levelZ),
                exteriorDoorInputs(layout, levelZ));
    }

    private GridArea blockedRoomCells(DungeonMap layout, int levelZ) {
        LinkedHashSet<GridPoint> blocked = new LinkedHashSet<>();
        for (Cluster cluster : layout.clusters()) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.roomTopology().rooms()) {
                if (room != null) {
                    blocked.addAll(cluster.roomTopology().structureFor(room).surfaceAtLevel(levelZ).surface().cellFootprint().cells());
                }
            }
        }
        return blocked.isEmpty() ? GridArea.empty() : GridArea.of(blocked);
    }

    private Map<DoorRef, CorridorResolutionInput.ExteriorDoorInput> exteriorDoorInputs(DungeonMap layout, int levelZ) {
        LinkedHashMap<DoorRef, CorridorResolutionInput.ExteriorDoorInput> result = new LinkedHashMap<>();
        for (Cluster cluster : layout.clusters()) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.roomTopology().rooms()) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                for (Door door : cluster.roomTopology().structureFor(room).boundaryAtLevel(levelZ).doors()) {
                    if (door == null || door.doorId() == null) {
                        continue;
                    }
                    DoorDescription description = layout.describeDoor(new DoorRef(door.doorId()));
                    if (description == null || !description.isRoomExterior()) {
                        continue;
                    }
                    RoomBoundaryDescription boundary = layout.describeRoomBoundary(
                            new DungeonSelectionRef.RoomBoundaryRef(room.roomId(), description.anchorSegment()),
                            levelZ);
                    if (boundary == null || !boundary.exterior()) {
                        continue;
                    }
                    result.put(description.ref(), new CorridorResolutionInput.ExteriorDoorInput(
                            description.ref(),
                            description.door(),
                            description.roomId(),
                            description.anchorSegment(),
                            boundary.roomCell(),
                            boundary.outwardDirection()));
                }
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private DungeonMap withCorridors(DungeonMap layout, List<Corridor> updatedCorridors) {
        return new DungeonMap(
                layout.mapId(),
                layout.name(),
                updatedCorridors,
                layout.clusters(),
                layout.stairs(),
                layout.transitions(),
                clusterLevelsById(layout));
    }

    private DungeonMap withStairs(DungeonMap layout, List<DungeonStair> updatedStairs) {
        return new DungeonMap(
                layout.mapId(),
                layout.name(),
                layout.corridors(),
                layout.clusters(),
                updatedStairs,
                layout.transitions(),
                clusterLevelsById(layout));
    }

    private DungeonMap withTransitions(DungeonMap layout, List<DungeonTransition> updatedTransitions) {
        return new DungeonMap(
                layout.mapId(),
                layout.name(),
                layout.corridors(),
                layout.clusters(),
                layout.stairs(),
                updatedTransitions,
                clusterLevelsById(layout));
    }

    private DungeonMap previewMutatedCluster(DungeonMap layout, Long clusterId, ClusterMutationRequest mutation) {
        if (layout == null || clusterId == null || mutation == null) {
            return layout;
        }
        Cluster cluster = layout.findCluster(clusterId);
        if (cluster == null) {
            return layout;
        }
        Cluster updatedCluster = cluster.mutated(mutation);
        if (updatedCluster == cluster) {
            return layout;
        }
        ClusterRewriteRequest rewriteRequest = ClusterRewriteRequest.of(
                List.of(cluster),
                List.of(updatedCluster),
                rewriteTranslation(mutation));
        DungeonMap rewrittenMap = applyClusterRewrite(layout, rewriteRequest);
        ClusterRewriteEffects rewriteEffects = reconcileClusterRewrite(
                new ReconcileClusterRewriteRequest(layout, rewrittenMap, rewriteRequest));
        return applyClusterRewriteEffects(rewrittenMap, rewriteEffects);
    }

    private DungeonMap applyClusterRewrite(DungeonMap layout, ClusterRewriteRequest request) {
        if (layout == null || request == null) {
            return layout;
        }
        List<Cluster> resolvedOriginalClusters = normalizedClusters(request.originalClusters());
        List<Cluster> resolvedFinalClusters = normalizedClusters(request.rewrittenClusters());
        if (resolvedOriginalClusters.isEmpty() && resolvedFinalClusters.isEmpty()) {
            return layout;
        }

        Set<Long> replacedClusterIds = resolvedOriginalClusters.stream()
                .map(Cluster::clusterId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Long, Cluster> replacementsById = new LinkedHashMap<>();
        ArrayList<Cluster> appendedClusters = new ArrayList<>();
        for (Cluster cluster : resolvedFinalClusters) {
            if (cluster == null) {
                continue;
            }
            if (cluster.clusterId() == null) {
                appendedClusters.add(cluster);
            } else {
                replacementsById.put(cluster.clusterId(), cluster);
            }
        }

        ArrayList<Cluster> updatedClusters = new ArrayList<>(layout.clusters().size() + resolvedFinalClusters.size());
        for (Cluster existing : layout.clusters()) {
            if (existing == null || existing.clusterId() == null || !replacedClusterIds.contains(existing.clusterId())) {
                updatedClusters.add(existing);
                continue;
            }
            Cluster replacement = replacementsById.remove(existing.clusterId());
            if (replacement != null) {
                updatedClusters.add(replacement);
            }
        }
        updatedClusters.addAll(replacementsById.values());
        updatedClusters.addAll(appendedClusters);

        LinkedHashMap<Long, Integer> updatedClusterLevels = new LinkedHashMap<>(clusterLevelsById(layout));
        for (Long clusterId : replacedClusterIds) {
            updatedClusterLevels.remove(clusterId);
        }
        for (Cluster cluster : resolvedFinalClusters) {
            if (cluster != null && cluster.clusterId() != null) {
                updatedClusterLevels.put(cluster.clusterId(), cluster.primaryLevel());
            }
        }
        return new DungeonMap(
                layout.mapId(),
                layout.name(),
                layout.corridors(),
                updatedClusters,
                layout.stairs(),
                layout.transitions(),
                updatedClusterLevels);
    }

    private DungeonMap applyClusterRewriteEffects(DungeonMap layout, ClusterRewriteEffects effects) {
        if (layout == null || effects == null) {
            return layout;
        }
        DungeonMap updatedMap = layout;
        if (!effects.reboundCorridors().isEmpty()) {
            LinkedHashMap<Long, Corridor> corridorUpdatesById = effects.reboundCorridors().stream()
                    .filter(Objects::nonNull)
                    .filter(corridor -> corridor.corridorId() != null)
                    .collect(Collectors.toMap(
                            Corridor::corridorId,
                            corridor -> corridor,
                            (left, right) -> right,
                            LinkedHashMap::new));
            if (!corridorUpdatesById.isEmpty()) {
                List<Corridor> updatedCorridors = layout.corridors().stream()
                        .map(corridor -> corridor == null || corridor.corridorId() == null
                                ? corridor
                                : corridorUpdatesById.getOrDefault(corridor.corridorId(), corridor))
                        .toList();
                updatedMap = withCorridors(updatedMap, updatedCorridors);
            }
        }
        if (!effects.reboundTransitionConnectionsById().isEmpty()) {
            Map<Long, DungeonConnection> transitionConnectionsById = effects.reboundTransitionConnectionsById();
            List<DungeonTransition> updatedTransitions = updatedMap.transitions().stream()
                    .map(transition -> transition == null || transition.transitionId() == null
                            ? transition
                            : transitionConnectionsById.containsKey(transition.transitionId())
                            ? transition.withLocalConnection(transitionConnectionsById.get(transition.transitionId()))
                            : transition)
                    .toList();
            updatedMap = withTransitions(updatedMap, updatedTransitions);
        }
        return updatedMap;
    }

    private void validateCorridorRewrite(
            DungeonMap originalMap,
            DungeonMap rewrittenMap,
            Set<Long> affectedRoomIds,
            GridTranslation translation
    ) {
        if (originalMap == null || rewrittenMap == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return;
        }
        for (Corridor corridor : originalMap.corridors()) {
            if (corridor != null && touchesAffectedRooms(corridor, affectedRoomIds)) {
                corridor.validateReconcile(corridorReconcileInput(originalMap, corridor, rewrittenMap, affectedRoomIds, translation));
            }
        }
    }

    private List<Corridor> reboundCorridors(
            DungeonMap originalMap,
            DungeonMap rewrittenMap,
            Set<Long> affectedRoomIds,
            GridTranslation translation
    ) {
        if (originalMap == null || rewrittenMap == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return List.of();
        }
        ArrayList<Corridor> reboundCorridors = new ArrayList<>();
        for (Corridor corridor : originalMap.corridors()) {
            if (corridor != null && touchesAffectedRooms(corridor, affectedRoomIds)) {
                Corridor reboundCorridor = corridor.reconciled(
                        corridorReconcileInput(originalMap, corridor, rewrittenMap, affectedRoomIds, translation));
                if (reboundCorridor != corridor) {
                    reboundCorridors.add(reboundCorridor);
                }
            }
        }
        return reboundCorridors.isEmpty() ? List.of() : List.copyOf(reboundCorridors);
    }

    private CorridorReconcileInput corridorReconcileInput(
            DungeonMap originalMap,
            Corridor corridor,
            DungeonMap updatedMap,
            Set<Long> affectedRoomIds,
            GridTranslation translation
    ) {
        Corridor resolvedCorridor = Objects.requireNonNull(corridor, "corridor");
        DungeonMap resolvedUpdatedMap = Objects.requireNonNull(updatedMap, "updatedMap");
        int corridorLevel = resolvedCorridor.levelZ();
        CorridorResolutionInput updatedResolution = corridorResolutionInput(resolvedUpdatedMap, corridorLevel);
        return new CorridorReconcileInput(
                affectedRoomIds,
                exteriorDoorInputs(originalMap, corridorLevel),
                exteriorDoorInputs(resolvedUpdatedMap, corridorLevel),
                translation,
                updatedResolution);
    }

    private boolean touchesAffectedRooms(Corridor corridor, Set<Long> affectedRoomIds) {
        if (corridor == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return false;
        }
        return corridor.connectedRoomIds().stream().anyMatch(affectedRoomIds::contains);
    }

    private void validateTransitionRewrite(
            DungeonMap originalMap,
            DungeonMap rewrittenMap,
            Set<Long> affectedRoomIds
    ) {
        if (originalMap == null || rewrittenMap == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return;
        }
        for (DungeonTransition transition : originalMap.transitions()) {
            if (touchesAffectedRooms(transition, affectedRoomIds)) {
                reboundTransitionLocalConnection(rewrittenMap, transition, affectedRoomIds, false);
            }
        }
    }

    private Map<Long, DungeonConnection> reboundTransitionConnections(
            DungeonMap originalMap,
            DungeonMap rewrittenMap,
            Set<Long> affectedRoomIds
    ) {
        if (originalMap == null || rewrittenMap == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<Long, DungeonConnection> reboundConnectionsById = new LinkedHashMap<>();
        for (DungeonTransition transition : originalMap.transitions()) {
            if (transition == null || transition.transitionId() == null || !touchesAffectedRooms(transition, affectedRoomIds)) {
                continue;
            }
            DungeonConnection reboundConnection = reboundTransitionLocalConnection(
                    rewrittenMap,
                    transition,
                    affectedRoomIds,
                    true);
            if (!Objects.equals(reboundConnection, transition.localConnection())) {
                reboundConnectionsById.put(transition.transitionId(), reboundConnection);
            }
        }
        return reboundConnectionsById.isEmpty() ? Map.of() : Map.copyOf(reboundConnectionsById);
    }

    private boolean touchesAffectedRooms(DungeonTransition transition, Set<Long> affectedRoomIds) {
        if (transition == null
                || transition.localConnection() == null
                || affectedRoomIds == null
                || affectedRoomIds.isEmpty()) {
            return false;
        }
        return transition.localConnection().endpoints().stream()
                .filter(Objects::nonNull)
                .filter(endpoint -> endpoint.type() == features.world.dungeon.model.structures.connection.ConnectionEndpointType.ROOM)
                .map(ConnectionEndpoint::id)
                .filter(Objects::nonNull)
                .anyMatch(affectedRoomIds::contains);
    }

    private DungeonConnection reboundTransitionLocalConnection(
            DungeonMap rewrittenMap,
            DungeonTransition transition,
            Set<Long> affectedRoomIds,
            boolean requirePersistedRoomId
    ) {
        if (rewrittenMap == null
                || transition == null
                || transition.localConnection() == null
                || affectedRoomIds == null
                || affectedRoomIds.isEmpty()) {
            return transition == null ? null : transition.localConnection();
        }
        DungeonConnection localConnection = transition.localConnection();
        if (localConnection.doorCarrier() != null) {
            ConnectionEndpoint entryEndpoint = localConnection.entryEndpoint();
            if (entryEndpoint == null
                    || entryEndpoint.type() != features.world.dungeon.model.structures.connection.ConnectionEndpointType.ROOM
                    || !affectedRoomIds.contains(entryEndpoint.id())) {
                return localConnection;
            }
            Room reboundRoom = resolveTransitionDoorRoom(
                    rewrittenMap,
                    localConnection.levelZ(),
                    localConnection.doorRef(),
                    requirePersistedRoomId);
            DoorDescription reboundDoor = rewrittenMap.describeDoor(localConnection.doorRef());
            if (reboundDoor == null) {
                throw new IllegalArgumentException("Transition door no longer resolves to a canonical door");
            }
            return new DungeonConnection(
                    localConnection.kind(),
                    localConnection.ownerId(),
                    localConnection.mapId(),
                    localConnection.levelZ(),
                    new DoorConnectionCarrier(reboundDoor.ref()),
                    List.of(ConnectionEndpoint.room(reboundRoom.roomId()), ConnectionEndpoint.transition(transition.transitionId())));
        }
        if (localConnection.stairCarrier() != null) {
            ConnectionEndpoint entryEndpoint = localConnection.entryEndpoint();
            if (entryEndpoint == null
                    || entryEndpoint.type() != features.world.dungeon.model.structures.connection.ConnectionEndpointType.ROOM
                    || !affectedRoomIds.contains(entryEndpoint.id())) {
                return localConnection;
            }
            StairConnectionCarrier stairCarrier = localConnection.stairCarrier();
            Room reboundRoom = roomWithFloorAtCell(rewrittenMap, stairCarrier.anchorCell(), stairCarrier.anchorLevelZ());
            if (reboundRoom == null) {
                throw new IllegalArgumentException("Transition stair anchor no longer resolves to a room floor");
            }
            if (requirePersistedRoomId && reboundRoom.roomId() == null) {
                throw new IllegalArgumentException("Transition stair rebound requires a persisted room id");
            }
            return new DungeonConnection(
                    localConnection.kind(),
                    localConnection.ownerId(),
                    localConnection.mapId(),
                    localConnection.levelZ(),
                    new StairConnectionCarrier(
                            stairCarrier.anchorCell(),
                            stairCarrier.anchorLevelZ(),
                            stairCarrier.stair()),
                    List.of(ConnectionEndpoint.room(reboundRoom.roomId()), ConnectionEndpoint.transition(transition.transitionId())));
        }
        return localConnection;
    }

    private Room resolveTransitionDoorRoom(
            DungeonMap rewrittenMap,
            int levelZ,
            DoorRef doorRef,
            boolean requirePersistedRoomId
    ) {
        if (rewrittenMap == null || doorRef == null) {
            throw new IllegalArgumentException("Transition door rebound requires a canonical door");
        }
        DoorDescription reboundDoor = rewrittenMap.describeDoor(doorRef);
        if (reboundDoor == null
                || reboundDoor.levelZ() != levelZ
                || reboundDoor.role() != features.world.dungeon.dungeonmap.api.DoorRole.ROOM_EXTERIOR) {
            throw new IllegalArgumentException("Transition door no longer resolves to an exterior room boundary");
        }
        Room reboundRoom = reboundDoor.touchingRooms().isEmpty() ? null : reboundDoor.touchingRooms().getFirst();
        if (reboundRoom == null) {
            throw new IllegalArgumentException("Transition door no longer resolves to an exterior room boundary");
        }
        if (requirePersistedRoomId && reboundRoom.roomId() == null) {
            throw new IllegalArgumentException("Transition door rebound requires a persisted room id");
        }
        return reboundRoom;
    }

    private Room roomWithFloorAtCell(DungeonMap layout, GridPoint cell, int levelZ) {
        Cluster cluster = layout == null || cell == null ? null : layout.clusterAtCell(cell, levelZ);
        Room room = cluster == null ? null : cluster.roomTopology().roomAt(cell, levelZ);
        return room != null && cluster.roomTopology().structureFor(room).surfaceAtLevel(levelZ).floor().contains(cell)
                ? room
                : null;
    }

    private static GridTranslation rewriteTranslation(ClusterMutationRequest mutation) {
        return mutation instanceof ClusterMutationRequest.Translation translation
                ? translation.translation()
                : GridTranslation.none();
    }

    private static List<Cluster> normalizedClusters(List<Cluster> clusters) {
        if (clusters == null || clusters.isEmpty()) {
            return List.of();
        }
        ArrayList<Cluster> result = new ArrayList<>();
        Set<Long> seenClusterIds = new LinkedHashSet<>();
        for (Cluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            if (cluster.clusterId() == null) {
                result.add(cluster);
                continue;
            }
            if (seenClusterIds.add(cluster.clusterId())) {
                result.add(cluster);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private Map<Long, Integer> clusterLevelsById(DungeonMap layout) {
        LinkedHashMap<Long, Integer> result = new LinkedHashMap<>();
        for (Cluster cluster : layout.clusters()) {
            if (cluster != null && cluster.clusterId() != null) {
                result.put(cluster.clusterId(), layout.levelForCluster(cluster.clusterId()));
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }
}
