package features.world.dungeon.dungeonmap.cluster.model;

import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.dungeonmap.structure.model.Structure;
import features.world.dungeon.dungeonmap.structure.model.StructureMutation;
import features.world.dungeon.dungeonmap.structure.model.StructureSpecification;
import features.world.dungeon.dungeonmap.structure.model.boundary.StructureBoundary;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeon.dungeonmap.structure.model.boundary.wall.Wall;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Supplier;

/**
 * Cluster rewrite owner for structure-backed cluster edits.
 *
 * <p>These workflows still return cluster carriers for persistence, but the room semantics themselves live under the
 * structure-owned room subtree instead of on {@link Cluster}.</p>
 */
public final class ClusterStructureEditor {

    private ClusterStructureEditor() {
    }

    public static Cluster applyPaint(
            Cluster cluster,
            Set<GridPoint> paintCells,
            List<Cluster> overlappingClusters,
            int paintLevel
    ) {
        if (cluster == null || paintCells == null || paintCells.isEmpty()) {
            return null;
        }
        List<Cluster> resolvedClusters = normalizedClusters(overlappingClusters);
        List<Room> touchedRooms = resolvedClusters.stream()
                .flatMap(candidate -> rooms(candidate).stream()
                        .filter(room -> room != null
                                && room.roomId() != null
                                && overlapsAtLevel(candidate, room, paintCells, paintLevel)))
                .sorted(Comparator.comparing(room -> room.roomId() == null ? Long.MAX_VALUE : room.roomId()))
                .toList();
        if (touchedRooms.isEmpty()) {
            return null;
        }

        Map<Integer, Set<GridPoint>> mergedClusterCellsByLevel = new LinkedHashMap<>();
        Map<Integer, Set<GridPoint>> mergedClusterFloorCellsByLevel = new LinkedHashMap<>();
        Map<Integer, List<Door>> mergedDoorsByLevel = new LinkedHashMap<>();
        Map<Integer, List<Wall>> mergedWallsByLevel = new LinkedHashMap<>();
        List<Room> mergedMetadataRooms = new ArrayList<>();
        for (Cluster overlappingCluster : resolvedClusters) {
            mergeClusterCellsByLevel(mergedClusterCellsByLevel, overlappingCluster);
            mergeClusterFloorCellsByLevel(mergedClusterFloorCellsByLevel, overlappingCluster);
            mergeDoorsByLevel(mergedDoorsByLevel, overlappingCluster);
            mergeWallsByLevel(mergedWallsByLevel, overlappingCluster);
            mergedMetadataRooms.addAll(rooms(overlappingCluster));
        }
        Map<Integer, Set<GridPoint>> previousClusterCellsByLevel = immutableCellsByLevel(mergedClusterCellsByLevel);
        mergedClusterCellsByLevel.computeIfAbsent(paintLevel, ignored -> new LinkedHashSet<>()).addAll(paintCells);
        mergedClusterFloorCellsByLevel.computeIfAbsent(paintLevel, ignored -> new LinkedHashSet<>()).addAll(paintCells);

        Structure mergedStructure = buildClusterStructure(
                mergedClusterCellsByLevel,
                mergedClusterFloorCellsByLevel,
                mergedDoorsByLevel,
                mergedWallsByLevel,
                previousClusterCellsByLevel);
        return new Cluster(
                cluster.clusterId(),
                cluster.structureObjectId(),
                cluster.mapId(),
                centerCell(flattenCells(mergedClusterCellsByLevel)),
                mergedStructure,
                normalizedMetadataRooms(mergedMetadataRooms));
    }

    public static List<Cluster> applyDelete(Cluster cluster, Set<GridPoint> deletedCells, int deleteLevel) {
        if (cluster == null || deletedCells == null || deletedCells.isEmpty()) {
            return null;
        }
        Map<Integer, Set<GridPoint>> remainingCellsByLevel = mutableClusterCellsByLevel(cluster);
        Set<GridPoint> remainingDeleteLevelCells = new LinkedHashSet<>(remainingCellsByLevel.getOrDefault(deleteLevel, Set.of()));
        if (!remainingDeleteLevelCells.removeAll(deletedCells)) {
            return null;
        }
        if (remainingDeleteLevelCells.isEmpty()) {
            remainingCellsByLevel.remove(deleteLevel);
        } else {
            remainingCellsByLevel.put(deleteLevel, Set.copyOf(remainingDeleteLevelCells));
        }
        if (remainingCellsByLevel.isEmpty()) {
            return List.of();
        }

        Map<Integer, Set<GridPoint>> remainingFloorCellsByLevel = mutableCellsByLevel(copyStructureFloorCellsByLevel(cluster));
        Set<GridPoint> remainingDeleteLevelFloorCells = new LinkedHashSet<>(remainingFloorCellsByLevel.getOrDefault(deleteLevel, Set.of()));
        remainingDeleteLevelFloorCells.removeAll(deletedCells);
        if (remainingDeleteLevelFloorCells.isEmpty()) {
            remainingFloorCellsByLevel.remove(deleteLevel);
        } else {
            remainingFloorCellsByLevel.put(deleteLevel, Set.copyOf(remainingDeleteLevelFloorCells));
        }

        Structure rewrittenStructure = buildClusterStructure(
                remainingCellsByLevel,
                remainingFloorCellsByLevel,
                doorsByLevel(cluster),
                wallsByLevel(cluster),
                copyStructureSurfaceCellsByLevel(cluster));
        List<Cluster> componentClusters = splitDeletedCluster(cluster, rewrittenStructure);
        if (componentClusters.isEmpty()) {
            return List.of();
        }
        ArrayList<Cluster> finalClusters = new ArrayList<>(componentClusters.size());
        finalClusters.add(withClusterId(componentClusters.getFirst(), cluster.clusterId()));
        finalClusters.addAll(componentClusters.stream().skip(1).toList());
        return List.copyOf(finalClusters);
    }

    public static List<Cluster> assignGeneratedClusterRoomNames(List<Cluster> clusters, Supplier<String> roomNameSupplier) {
        if (clusters == null || roomNameSupplier == null) {
            return clusters;
        }
        boolean changed = false;
        List<Cluster> renamedClusters = new ArrayList<>(clusters.size());
        for (Cluster cluster : clusters) {
            if (cluster == null) {
                renamedClusters.add(null);
                continue;
            }
            List<Room> renamedRooms = assignGeneratedNamesToRooms(rooms(cluster), roomNameSupplier);
            if (renamedRooms.equals(rooms(cluster))) {
                renamedClusters.add(cluster);
                continue;
            }
            renamedClusters.add(new Cluster(
                    cluster.clusterId(),
                    cluster.structureObjectId(),
                    cluster.mapId(),
                    cluster.center(),
                    cluster,
                    renamedRooms));
            changed = true;
        }
        return changed ? List.copyOf(renamedClusters) : clusters;
    }

    private static List<Room> assignGeneratedNamesToRooms(List<Room> rooms, Supplier<String> roomNameSupplier) {
        if (rooms == null || rooms.isEmpty()) {
            return List.of();
        }
        boolean changed = false;
        List<Room> renamedRooms = new ArrayList<>(rooms.size());
        for (Room room : rooms) {
            if (room == null || room.roomId() != null || room.name() != null && !room.name().isBlank()) {
                renamedRooms.add(room);
                continue;
            }
            String generatedName = roomNameSupplier.get();
            Room renamedRoom = room.withName(
                    generatedName == null || generatedName.isBlank() ? "Raum neu" : generatedName.trim());
            renamedRooms.add(renamedRoom);
            changed = true;
        }
        return changed ? List.copyOf(renamedRooms) : rooms;
    }

    private static Cluster withClusterId(Cluster cluster, Long clusterId) {
        long resolvedClusterId = clusterId == null ? 0L : clusterId;
        List<Room> reassignedRooms = rooms(cluster).stream()
                .map(room -> room == null ? null : room.withClusterId(resolvedClusterId))
                .toList();
        return new Cluster(
                clusterId,
                cluster.structureObjectId(),
                cluster.mapId(),
                cluster.center(),
                cluster,
                reassignedRooms);
    }

    private static List<Room> rooms(Cluster cluster) {
        return cluster == null ? List.of() : cluster.roomTopology().rooms();
    }

    private static Structure roomStructure(Cluster cluster, Room room) {
        return cluster == null ? Structure.empty() : cluster.roomTopology().structureFor(room);
    }

    private static Set<Integer> roomLevels(Cluster cluster, Room room) {
        return cluster == null ? Set.of() : cluster.roomTopology().roomLevels(room);
    }

    private static Room roomAt(Cluster cluster, GridPoint cell, int levelZ) {
        return cluster == null || cell == null ? null : cluster.roomTopology().roomAt(cell, levelZ);
    }

    private static List<Cluster> normalizedClusters(List<Cluster> clusters) {
        if (clusters == null || clusters.isEmpty()) {
            return List.of();
        }
        Map<Long, Cluster> result = new LinkedHashMap<>();
        for (Cluster cluster : clusters) {
            if (cluster != null && cluster.clusterId() != null) {
                result.put(cluster.clusterId(), cluster);
            }
        }
        return List.copyOf(result.values());
    }

    private static boolean disjoint(Set<GridPoint> left, Set<GridPoint> right) {
        for (GridPoint point : left) {
            if (right.contains(point)) {
                return false;
            }
        }
        return true;
    }

    private static boolean overlapsAtLevel(Cluster cluster, Room room, Set<GridPoint> paintCells, int levelZ) {
        if (room == null || paintCells == null || paintCells.isEmpty()) {
            return false;
        }
        return !disjoint(roomStructure(cluster, room).surfaceAtLevel(levelZ).surface().cells(), paintCells);
    }

    private static List<Room> normalizedMetadataRooms(List<Room> rooms) {
        if (rooms == null || rooms.isEmpty()) {
            return List.of();
        }
        Map<Long, Room> persistedRoomsById = new LinkedHashMap<>();
        List<Room> transientRooms = new ArrayList<>();
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            if (room.roomId() == null) {
                transientRooms.add(room);
                continue;
            }
            persistedRoomsById.putIfAbsent(room.roomId(), room);
        }
        ArrayList<Room> result = new ArrayList<>(persistedRoomsById.values());
        result.sort(Comparator.comparing(Room::roomId));
        transientRooms.sort(Comparator
                .comparing(Room::name, Comparator.nullsLast(String::compareTo))
                .thenComparingInt(Room::primaryLevel));
        result.addAll(transientRooms);
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Map<Integer, Set<GridPoint>> copyStructureSurfaceCellsByLevel(Structure structure) {
        if (structure == null || structure.levels().isEmpty()) {
            return Map.of();
        }
        Map<Integer, Set<GridPoint>> result = new LinkedHashMap<>();
        for (Integer levelZ : structure.levels().stream().sorted().toList()) {
            Set<GridPoint> levelCells = structure.surfaceAtLevel(levelZ).surface().cells();
            if (!levelCells.isEmpty()) {
                result.put(levelZ, levelCells);
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<Integer, Set<GridPoint>> copyStructureFloorCellsByLevel(Structure structure) {
        if (structure == null || structure.levels().isEmpty()) {
            return Map.of();
        }
        Map<Integer, Set<GridPoint>> result = new LinkedHashMap<>();
        for (Integer levelZ : structure.levels().stream().sorted().toList()) {
            Set<GridPoint> floorCells = structure.surfaceAtLevel(levelZ).floor().cells();
            if (!floorCells.isEmpty()) {
                result.put(levelZ, floorCells);
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static List<Map<Integer, Set<GridPoint>>> splitProjectedSurfaceIntoComponents(Structure structure) {
        if (structure == null || structure.levels().isEmpty()) {
            return List.of();
        }
        Set<GridPoint> projectedCells = projectedSurfaceCells(structure);
        if (projectedCells.isEmpty()) {
            return List.of();
        }
        List<Set<GridPoint>> components = connectedProjectedCellComponents(projectedCells);
        ArrayList<Map<Integer, Set<GridPoint>>> result = new ArrayList<>(components.size());
        for (Set<GridPoint> component : components) {
            Map<Integer, Set<GridPoint>> componentByLevel = new LinkedHashMap<>();
            for (Integer levelZ : structure.levels().stream().sorted().toList()) {
                Set<GridPoint> levelCells = intersectCells(structure.surfaceAtLevel(levelZ).surface().cells(), component);
                if (!levelCells.isEmpty()) {
                    componentByLevel.put(levelZ, levelCells);
                }
            }
            if (!componentByLevel.isEmpty()) {
                result.add(Map.copyOf(componentByLevel));
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Set<GridPoint> projectedSurfaceCells(Structure structure) {
        if (structure == null || structure.levels().isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        for (Integer levelZ : structure.levels().stream().sorted().toList()) {
            result.addAll(structure.surfaceAtLevel(levelZ).surface().cells());
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static List<Set<GridPoint>> connectedProjectedCellComponents(Collection<GridPoint> cells) {
        Set<GridPoint> remaining = normalizedCells(cells);
        if (remaining.isEmpty()) {
            return List.of();
        }
        ArrayList<Set<GridPoint>> components = new ArrayList<>();
        LinkedHashSet<GridPoint> unvisited = new LinkedHashSet<>(remaining);
        while (!unvisited.isEmpty()) {
            GridPoint seed = unvisited.iterator().next();
            ArrayDeque<GridPoint> queue = new ArrayDeque<>();
            LinkedHashSet<GridPoint> component = new LinkedHashSet<>();
            queue.add(seed);
            unvisited.remove(seed);
            while (!queue.isEmpty()) {
                GridPoint current = queue.removeFirst();
                if (!component.add(current)) {
                    continue;
                }
                for (CardinalDirection direction : CardinalDirection.values()) {
                    GridPoint neighbor = current.step(direction);
                    if (unvisited.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            components.add(Set.copyOf(component));
        }
        return components.isEmpty() ? List.of() : List.copyOf(components);
    }

    private static void mergeClusterCellsByLevel(Map<Integer, Set<GridPoint>> result, Structure structure) {
        if (result == null || structure == null) {
            return;
        }
        for (Map.Entry<Integer, Set<GridPoint>> entry : copyStructureSurfaceCellsByLevel(structure).entrySet()) {
            result.computeIfAbsent(entry.getKey(), ignored -> new LinkedHashSet<>()).addAll(entry.getValue());
        }
    }

    private static void mergeClusterFloorCellsByLevel(Map<Integer, Set<GridPoint>> result, Structure structure) {
        if (result == null || structure == null) {
            return;
        }
        for (Map.Entry<Integer, Set<GridPoint>> entry : copyStructureFloorCellsByLevel(structure).entrySet()) {
            result.computeIfAbsent(entry.getKey(), ignored -> new LinkedHashSet<>()).addAll(entry.getValue());
        }
    }

    private static void mergeDoorsByLevel(Map<Integer, List<Door>> result, Structure structure) {
        if (result == null || structure == null) {
            return;
        }
        for (Map.Entry<Integer, List<Door>> entry : doorsByLevel(structure).entrySet()) {
            result.computeIfAbsent(entry.getKey(), ignored -> new ArrayList<>()).addAll(entry.getValue());
        }
    }

    private static void mergeWallsByLevel(Map<Integer, List<Wall>> result, Structure structure) {
        if (result == null || structure == null) {
            return;
        }
        for (Map.Entry<Integer, List<Wall>> entry : wallsByLevel(structure).entrySet()) {
            result.computeIfAbsent(entry.getKey(), ignored -> new ArrayList<>()).addAll(entry.getValue());
        }
    }

    private static Map<Integer, List<Door>> doorsByLevel(Structure structure) {
        if (structure == null || structure.levels().isEmpty()) {
            return Map.of();
        }
        Map<Integer, List<Door>> result = new LinkedHashMap<>();
        for (Integer levelZ : structure.levels().stream().sorted().toList()) {
            List<Door> doors = structure.boundaryAtLevel(levelZ).doors();
            if (!doors.isEmpty()) {
                result.put(levelZ, doors);
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<Integer, List<Wall>> wallsByLevel(Structure structure) {
        if (structure == null || structure.levels().isEmpty()) {
            return Map.of();
        }
        Map<Integer, List<Wall>> result = new LinkedHashMap<>();
        for (Integer levelZ : structure.levels().stream().sorted().toList()) {
            List<Wall> walls = structure.boundaryAtLevel(levelZ).walls();
            if (!walls.isEmpty()) {
                result.put(levelZ, walls);
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Structure buildClusterStructure(
            Map<Integer, Set<GridPoint>> cellsByLevel,
            Map<Integer, Set<GridPoint>> floorCellsByLevel,
            Map<Integer, List<Door>> doorsByLevel,
            Map<Integer, List<Wall>> wallsByLevel,
            Map<Integer, Set<GridPoint>> previousCellsByLevel
    ) {
        Map<Integer, Set<GridPoint>> normalizedCellsByLevel = immutableCellsByLevel(cellsByLevel);
        if (normalizedCellsByLevel.isEmpty()) {
            return Structure.empty();
        }
        Map<Integer, Set<GridPoint>> normalizedFloorCellsByLevel = immutableFloorCellsByLevel(floorCellsByLevel);
        Map<Integer, StructureSpecification.LevelSpecification> levelsByZ = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<GridPoint>> entry : normalizedCellsByLevel.entrySet()) {
            Integer levelZ = entry.getKey();
            Set<GridPoint> levelCells = entry.getValue();
            if (levelZ == null || levelCells == null || levelCells.isEmpty()) {
                continue;
            }
            List<Wall> levelWalls = wallsByLevel == null ? List.of() : wallsByLevel.getOrDefault(levelZ, List.of());
            List<Door> levelDoors = doorsByLevel == null ? List.of() : doorsByLevel.getOrDefault(levelZ, List.of());
            StructureBoundary boundary = previousCellsByLevel == null
                    ? StructureBoundary.fromSurfaceAndFeatures(levelCells, levelDoors, levelWalls)
                    : StructureBoundary.rewrittenForSurface(
                    previousCellsByLevel.getOrDefault(levelZ, Set.of()),
                    levelCells,
                    levelDoors,
                    levelWalls);
            levelsByZ.put(levelZ, new StructureSpecification.LevelSpecification(
                    centerCell(levelCells),
                    features.world.dungeon.geometry.GridArea.of(levelCells),
                    features.world.dungeon.geometry.GridArea.of(normalizedFloorCellsByLevel.getOrDefault(levelZ, Set.of())),
                    boundary.doors(),
                    boundary.walls()));
        }
        return Structure.fromSpecification(new StructureSpecification(levelsByZ));
    }

    private static List<Cluster> splitDeletedCluster(Cluster originalCluster, Structure rewrittenStructure) {
        if (originalCluster == null || rewrittenStructure == null || rewrittenStructure.levels().isEmpty()) {
            return List.of();
        }
        Map<Integer, List<Door>> doorsByLevel = doorsByLevel(rewrittenStructure);
        Map<Integer, List<Wall>> wallsByLevel = wallsByLevel(rewrittenStructure);
        List<Map<Integer, Set<GridPoint>>> projectedComponents = splitProjectedSurfaceIntoComponents(rewrittenStructure);
        if (projectedComponents.isEmpty()) {
            return List.of();
        }
        return projectedComponents.stream()
                .sorted(Comparator
                        .comparing((Map<Integer, Set<GridPoint>> component) -> !flattenCells(component).contains(originalCluster.center()))
                        .thenComparingInt(component -> manhattanCellDistance(centerCell(flattenCells(component)), originalCluster.center()))
                        .thenComparing(component -> centerCell(flattenCells(component)), GridPoint.ORDER))
                .map(componentCellsByLevel -> componentCluster(
                        originalCluster,
                        componentCellsByLevel,
                        copyStructureFloorCellsByLevel(rewrittenStructure),
                        doorsByLevel,
                        wallsByLevel))
                .filter(Objects::nonNull)
                .toList();
    }

    private static Cluster componentCluster(
            Cluster originalCluster,
            Map<Integer, Set<GridPoint>> componentCellsByLevel,
            Map<Integer, Set<GridPoint>> clusterFloorCellsByLevel,
            Map<Integer, List<Door>> clusterDoorsByLevel,
            Map<Integer, List<Wall>> clusterWallsByLevel
    ) {
        Map<Integer, Set<GridPoint>> componentFloorCellsByLevel = new LinkedHashMap<>();
        Map<Integer, List<Door>> componentDoorsByLevel = new LinkedHashMap<>();
        Map<Integer, List<Wall>> componentWallsByLevel = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<GridPoint>> entry : componentCellsByLevel.entrySet()) {
            Integer levelZ = entry.getKey();
            Set<GridPoint> levelComponentCells = entry.getValue();
            if (levelComponentCells.isEmpty()) {
                continue;
            }
            Set<GridPoint> levelFloorCells = intersectCells(clusterFloorCellsByLevel.get(levelZ), levelComponentCells);
            componentFloorCellsByLevel.put(levelZ, levelFloorCells);
            List<Door> levelDoors = clusterDoorsByLevel.getOrDefault(levelZ, List.of()).stream()
                    .filter(door -> door != null && door.touchesAnyCell(features.world.dungeon.geometry.GridArea.of(levelComponentCells)))
                    .toList();
            if (!levelDoors.isEmpty()) {
                componentDoorsByLevel.put(levelZ, levelDoors);
            }
            List<Wall> levelWalls = clusterWallsByLevel.getOrDefault(levelZ, List.of()).stream()
                    .filter(wall -> wall != null && wall.touchesAnyCell(features.world.dungeon.geometry.GridArea.of(levelComponentCells)))
                    .toList();
            if (!levelWalls.isEmpty()) {
                componentWallsByLevel.put(levelZ, levelWalls);
            }
        }
        if (componentCellsByLevel.isEmpty()) {
            return null;
        }
        Structure componentStructure = buildClusterStructure(
                componentCellsByLevel,
                componentFloorCellsByLevel,
                componentDoorsByLevel,
                componentWallsByLevel,
                null);
        return new Cluster(
                null,
                null,
                originalCluster.mapId(),
                centerCell(flattenCells(componentCellsByLevel)),
                componentStructure,
                metadataRoomsForComponent(rooms(originalCluster), componentStructure));
    }

    private static List<Room> metadataRoomsForComponent(List<Room> rooms, Structure componentStructure) {
        if (rooms == null || rooms.isEmpty() || componentStructure == null || componentStructure.levels().isEmpty()) {
            return List.of();
        }
        return rooms.stream()
                .filter(room -> room != null && room.anchorsByLevel().entrySet().stream()
                        .anyMatch(entry -> componentStructure.surfaceAtLevel(entry.getKey()).surface().contains(entry.getValue())))
                .sorted(Comparator.comparing(Room::roomId, Comparator.nullsLast(Long::compareTo)))
                .toList();
    }

    private static Map<Integer, Set<GridPoint>> mutableClusterCellsByLevel(Cluster cluster) {
        return mutableCellsByLevel(cluster == null ? Map.of() : copyStructureSurfaceCellsByLevel(cluster));
    }

    private static Set<GridPoint> flattenCells(Map<Integer, Set<GridPoint>> cellsByLevel) {
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        for (Set<GridPoint> cells : cellsByLevel.values()) {
            result.addAll(cells);
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static int manhattanCellDistance(GridPoint start, GridPoint end) {
        if (start == null || end == null) {
            return Integer.MAX_VALUE;
        }
        return Math.abs(start.cellX() - end.cellX()) + Math.abs(start.cellY() - end.cellY());
    }

    private static Map<Integer, Set<GridPoint>> mutableCellsByLevel(Map<Integer, Set<GridPoint>> source) {
        Map<Integer, Set<GridPoint>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<GridPoint>> entry : source.entrySet()) {
            result.put(entry.getKey(), new LinkedHashSet<>(entry.getValue()));
        }
        return result;
    }

    private static Map<Integer, Set<GridPoint>> immutableCellsByLevel(Map<Integer, Set<GridPoint>> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Set<GridPoint>> result = new LinkedHashMap<>();
        source.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    Set<GridPoint> cells = normalizedCells(entry.getValue());
                    if (!cells.isEmpty()) {
                        result.put(entry.getKey(), cells);
                    }
                });
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Set<GridPoint> intersectCells(Set<GridPoint> left, Set<GridPoint> right) {
        if (left == null || left.isEmpty() || right == null || right.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        for (GridPoint cell : left) {
            if (right.contains(cell)) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Map<Integer, Set<GridPoint>> immutableFloorCellsByLevel(Map<Integer, Set<GridPoint>> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Set<GridPoint>> result = new LinkedHashMap<>();
        source.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null && entry.getValue() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> result.put(entry.getKey(), normalizedCells(entry.getValue())));
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Set<GridPoint> normalizedCells(Collection<GridPoint> cells) {
        return features.world.dungeon.geometry.GridArea.of(cells).cells();
    }

    private static GridPoint centerCell(Collection<GridPoint> cells) {
        return features.world.dungeon.geometry.GridArea.of(cells).center();
    }
}
