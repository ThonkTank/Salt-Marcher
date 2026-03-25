package features.world.dungeonmap.state;

import java.util.LinkedHashSet;
import java.util.Set;

public sealed interface EditorDraft permits EditorDraft.CorridorDraft, EditorDraft.BoundaryDraft {

    record CorridorDraft(PendingStart pendingStart) implements EditorDraft {
    }

    record BoundaryDraft(
            Long clusterId,
            String statusMessage
    ) implements EditorDraft {
        public BoundaryDraft {
            statusMessage = statusMessage == null ? "" : statusMessage;
        }
    }

    sealed interface PendingTarget permits PendingTarget.Room, PendingTarget.Corridor {
        String targetKey();

        record Room(Long roomId, String targetKey) implements PendingTarget {
        }

        record Corridor(Long corridorId, String targetKey) implements PendingTarget {
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
            if (target instanceof PendingTarget.Corridor corridor && corridor.corridorId() != null) {
                return "Korridor " + corridor.corridorId();
            }
            return "Ziel";
        }
    }
}
