package features.world.dungeonmap.application.traversal;

public sealed interface TraversalTarget permits TraversalTarget.Room, TraversalTarget.CorridorSegment, TraversalTarget.StairSegment {

    String targetKey();

    record Room(long roomId, String targetKey) implements TraversalTarget {
    }

    record CorridorSegment(long corridorId, String targetKey) implements TraversalTarget {
    }

    record StairSegment(long stairId, String targetKey) implements TraversalTarget {
    }
}
