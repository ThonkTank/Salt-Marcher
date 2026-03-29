package features.world.dungeonmap.state;

public sealed interface EditorDraft permits EditorDraft.TraversalDraft, EditorDraft.BoundaryDraft {

    record TraversalDraft(PendingStart pendingStart) implements EditorDraft {
    }

    record BoundaryDraft(
            Long clusterId,
            String statusMessage
    ) implements EditorDraft {
        public BoundaryDraft {
            statusMessage = statusMessage == null ? "" : statusMessage;
        }
    }

    sealed interface PendingTarget permits PendingTarget.Room, PendingTarget.CorridorSegment, PendingTarget.StairSegment {
        String targetKey();

        record Room(Long roomId, String targetKey) implements PendingTarget {
        }

        record CorridorSegment(Long corridorId, String targetKey) implements PendingTarget {
        }

        record StairSegment(Long stairId, String targetKey) implements PendingTarget {
        }
    }

    record PendingStart(
            PendingTarget target,
            int levelZ,
            String displayLabel
    ) {
        public PendingStart {
            displayLabel = displayLabel == null || displayLabel.isBlank()
                    ? defaultDisplayLabel(target)
                    : displayLabel;
        }

        private static String defaultDisplayLabel(PendingTarget target) {
            if (target instanceof PendingTarget.Room room && room.roomId() != null) {
                return "Raum " + room.roomId();
            }
            if (target instanceof PendingTarget.CorridorSegment corridor && corridor.corridorId() != null) {
                return "Korridor " + corridor.corridorId();
            }
            if (target instanceof PendingTarget.StairSegment stair && stair.stairId() != null) {
                return "Treppe " + stair.stairId();
            }
            return "Ziel";
        }
    }
}
