package features.world.dungeonmap.model.structures.traversal;

public sealed interface TraversalSegmentRef permits TraversalSegmentRef.CorridorSegment, TraversalSegmentRef.StairSegment {

    Long structureId();

    record CorridorSegment(Long corridorId) implements TraversalSegmentRef {
        @Override
        public Long structureId() {
            return corridorId;
        }
    }

    record StairSegment(Long stairId) implements TraversalSegmentRef {
        @Override
        public Long structureId() {
            return stairId;
        }
    }
}
