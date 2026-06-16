package src.domain.dungeon.model.core.structure.door;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;

public final class DoorIndex {
    private final Map<DoorKey, Door> doorsByBoundary;

    public static DoorIndex from(Iterable<Door> doors) {
        return new DoorIndex(doors);
    }

    public DoorIndex(Iterable<Door> doors) {
        Map<DoorKey, Door> result = new LinkedHashMap<>();
        for (Door door : sortedDoors(doors)) {
            result.putIfAbsent(DoorKey.from(door), door);
        }
        this.doorsByBoundary = Collections.unmodifiableMap(result);
    }

    private DoorIndex(Map<DoorKey, Door> doorsByBoundary) {
        this.doorsByBoundary = Collections.unmodifiableMap(new LinkedHashMap<>(doorsByBoundary));
    }

    public List<Door> doors() {
        return List.copyOf(doorsByBoundary.values());
    }

    public Optional<Door> doorAt(long clusterId, Cell relativeCell, Direction direction) {
        return Optional.ofNullable(doorsByBoundary.get(new DoorKey(clusterId, relativeCell, direction)));
    }

    public DoorIndex withDoor(Door door) {
        if (door == null) {
            return this;
        }
        Map<DoorKey, Door> result = new LinkedHashMap<>(doorsByBoundary);
        result.putIfAbsent(DoorKey.from(door), door);
        return new DoorIndex(result);
    }

    public boolean canDelete(Door door, boolean corridorBound) {
        if (door == null || doorAt(door.clusterId(), door.relativeCell(), door.direction())
                .filter(door::equals)
                .isEmpty()) {
            return false;
        }
        return !corridorBound;
    }

    public DoorIndex withoutDoor(Door door, boolean corridorBound) {
        if (!canDelete(door, corridorBound)) {
            return this;
        }
        Map<DoorKey, Door> result = new LinkedHashMap<>(doorsByBoundary);
        result.remove(DoorKey.from(door));
        return new DoorIndex(result);
    }

    public boolean canMoveDoor(Door currentDoor, Door movedDoor) {
        if (currentDoor == null || movedDoor == null) {
            return false;
        }
        Optional<Door> existing = doorAt(currentDoor.clusterId(), currentDoor.relativeCell(), currentDoor.direction());
        if (existing.filter(currentDoor::equals).isEmpty()) {
            return false;
        }
        DoorKey currentKey = DoorKey.from(currentDoor);
        DoorKey movedKey = DoorKey.from(movedDoor);
        return currentKey.equals(movedKey) || !doorsByBoundary.containsKey(movedKey);
    }

    private static List<Door> sortedDoors(Iterable<Door> doors) {
        List<Door> result = new ArrayList<>();
        for (Door door : doors == null ? List.<Door>of() : doors) {
            if (door != null) {
                result.add(door);
            }
        }
        result.sort(java.util.Comparator.comparingLong(Door::clusterId)
                .thenComparingInt(door -> door.relativeCell().level())
                .thenComparingInt(door -> door.relativeCell().r())
                .thenComparingInt(door -> door.relativeCell().q())
                .thenComparing(door -> door.direction().name())
                .thenComparingLong(Door::doorId));
        return List.copyOf(result);
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof DoorIndex that
                && doorsByBoundary.equals(that.doorsByBoundary);
    }

    @Override
    public int hashCode() {
        return Objects.hash(doorsByBoundary);
    }

    private record DoorKey(long clusterId, Cell relativeCell, Direction direction) {
        private DoorKey {
            Objects.requireNonNull(relativeCell);
            Objects.requireNonNull(direction);
        }

        static DoorKey from(Door door) {
            return new DoorKey(door.clusterId(), door.relativeCell(), door.direction());
        }
    }

}
