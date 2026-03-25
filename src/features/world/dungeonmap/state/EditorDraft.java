package features.world.dungeonmap.state;

import features.world.dungeonmap.application.transition.DungeonTransitionEditRequest;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.structures.stair.StairShape;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public sealed interface EditorDraft permits EditorDraft.CorridorDraft, EditorDraft.StairDraft, EditorDraft.TransitionDraft, EditorDraft.BoundaryDraft {

    record CorridorDraft(PendingStart pendingStart) implements EditorDraft {
    }

    record StairDraft(
            int inputLevel,
            StairShape shape,
            CardinalDirection direction,
            int dimension1,
            int dimension2,
            List<Integer> exitLevels,
            String statusMessage,
            String placementError
    ) implements EditorDraft {
        public StairDraft {
            shape = shape == null ? StairShape.LADDER : shape;
            direction = direction == null ? CardinalDirection.defaultDirection() : direction;
            exitLevels = exitLevels == null ? List.of() : List.copyOf(exitLevels);
            statusMessage = statusMessage == null ? "" : statusMessage;
            placementError = placementError == null || placementError.isBlank() ? null : placementError.trim();
        }
    }

    record TransitionDraft(
            String description,
            DungeonTransitionEditRequest.DestinationType destinationType,
            boolean bidirectional,
            Long targetDungeonMapId,
            Long targetTransitionId,
            Long targetOverworldMapId,
            Long targetOverworldTileId,
            Long preparedTransitionId,
            String placementError
    ) implements EditorDraft {
        public TransitionDraft {
            description = description == null ? "" : description.trim();
            destinationType = destinationType == null
                    ? DungeonTransitionEditRequest.DestinationType.OVERWORLD_TILE
                    : destinationType;
            placementError = placementError == null || placementError.isBlank() ? null : placementError.trim();
        }
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
