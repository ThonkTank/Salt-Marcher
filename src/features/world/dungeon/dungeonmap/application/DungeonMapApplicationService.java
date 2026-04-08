package features.world.dungeon.dungeonmap.application;

import features.world.dungeon.dungeonmap.api.PreviewAddedCorridorRequest;
import features.world.dungeon.dungeonmap.api.PreviewAddedStairRequest;
import features.world.dungeon.dungeonmap.api.PreviewAddedTransitionRequest;
import features.world.dungeon.dungeonmap.api.PreviewRemovedCorridorRequest;
import features.world.dungeon.dungeonmap.api.PreviewRemovedStairRequest;
import features.world.dungeon.dungeonmap.api.PreviewRemovedTransitionRequest;
import features.world.dungeon.dungeonmap.api.PreviewReplacedCorridorRequest;
import features.world.dungeon.dungeonmap.api.PreviewReplacedStairRequest;
import features.world.dungeon.dungeonmap.api.PreviewReplacedTransitionRequest;
import features.world.dungeon.dungeonmap.api.RehydrateCorridorRequest;
import features.world.dungeon.dungeonmap.api.ResolveCorridorRequest;
import features.world.dungeon.dungeonmap.api.DoorDescription;
import features.world.dungeon.dungeonmap.api.RoomBoundaryDescription;
import features.world.dungeon.dungeonmap.cluster.model.Cluster;
import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.corridor.model.CorridorInput;
import features.world.dungeon.dungeonmap.corridor.model.CorridorResolutionInput;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.model.structures.stair.DungeonStair;
import features.world.dungeon.model.structures.transition.DungeonTransition;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Map-owned workflow seam for corridor resolution, rehydration, and preview snapshot composition.
 *
 * <p>Corridor aggregates still own their authored input and reconciliation behavior. This service owns only the
 * map-external facts required to build corridors and compose corridor, stair, or transition previews from one
 * authoritative loaded map snapshot.</p>
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
