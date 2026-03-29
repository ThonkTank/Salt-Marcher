package features.world.dungeonmap.application.traversal;

public sealed interface TraversalSegmentRef permits TraversalSegmentRef.CorridorSegment, TraversalSegmentRef.StairSegment {

    record CorridorSegment(long corridorId) implements TraversalSegmentRef {
    }

    record StairSegment(long stairId) implements TraversalSegmentRef {
    }
}
