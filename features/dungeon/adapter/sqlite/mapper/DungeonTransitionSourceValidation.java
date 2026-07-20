package features.dungeon.adapter.sqlite.mapper;

import features.dungeon.adapter.sqlite.model.DungeonTransitionRecord;
import java.util.Locale;
import java.util.Set;

/** Shared validation for raw transition source columns before domain normalization. */
public final class DungeonTransitionSourceValidation {

    private static final Set<String> CARDINAL_DIRECTIONS = Set.of("NORTH", "EAST", "SOUTH", "WEST");

    private DungeonTransitionSourceValidation() {
    }

    public static void validate(DungeonTransitionRecord transition) {
        boolean coordinatesPresent = transition.cellX() != null
                && transition.cellY() != null
                && transition.levelZ() != null;
        boolean coordinatesAbsent = transition.cellX() == null
                && transition.cellY() == null
                && transition.levelZ() == null;
        String anchorType = normalized(transition.anchorType());
        boolean anchorValid = ("NONE".equals(anchorType)
                && coordinatesAbsent && transition.anchorEdgeDirection() == null)
                || ("CELL".equals(anchorType)
                && coordinatesPresent && transition.anchorEdgeDirection() == null)
                || ("EDGE".equals(anchorType)
                && coordinatesPresent
                && CARDINAL_DIRECTIONS.contains(normalized(transition.anchorEdgeDirection())));

        String destinationType = normalized(transition.destinationType());
        boolean unlinked = transition.targetOverworldMapId() == null
                && transition.targetOverworldTileId() == null
                && transition.targetDungeonMapId() == null
                && transition.targetTransitionId() == null;
        boolean overworld = positive(transition.targetOverworldMapId())
                && positive(transition.targetOverworldTileId())
                && transition.targetDungeonMapId() == null
                && transition.targetTransitionId() == null;
        boolean dungeon = positive(transition.targetDungeonMapId())
                && transition.targetOverworldMapId() == null
                && transition.targetOverworldTileId() == null
                && (transition.targetTransitionId() == null || positive(transition.targetTransitionId()));
        boolean destinationValid = ("UNLINKED_ENTRANCE".equals(destinationType) && unlinked)
                || ("OVERWORLD_TILE".equals(destinationType) && overworld)
                || ("DUNGEON_MAP".equals(destinationType) && dungeon);

        if (!anchorValid
                || !destinationValid
                || (transition.linkedTransitionId() != null && !positive(transition.linkedTransitionId()))) {
            throw new Failure("transition source columns are invalid");
        }
    }

    private static boolean positive(Long value) {
        return value != null && value > 0L;
    }

    private static String normalized(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    public static final class Failure extends IllegalArgumentException {
        private Failure(String message) {
            super(message);
        }
    }
}
