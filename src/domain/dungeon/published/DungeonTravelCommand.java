package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public sealed interface DungeonTravelCommand permits
        DungeonTravelCommand.LoadSurface,
        DungeonTravelCommand.MoveAction {

    int LOAD_SURFACE_OPERATION = 1;
    int MOVE_ACTION_OPERATION = 2;

    int operationKey();

    boolean hasPosition();

    long mapIdValue();

    String locationKindName();

    long ownerId();

    int tileQ();

    int tileR();

    int tileLevel();

    String headingName();

    String actionId();

    record LoadSurface(@Nullable DungeonTravelPosition position) implements DungeonTravelCommand {

        @Override
        public int operationKey() {
            return LOAD_SURFACE_OPERATION;
        }

        @Override
        public boolean hasPosition() {
            return position != null;
        }

        @Override
        public long mapIdValue() {
            return position == null ? 1L : position.mapId().value();
        }

        @Override
        public String locationKindName() {
            return position == null ? DungeonTravelLocationKind.TILE.name() : position.locationKind().name();
        }

        @Override
        public long ownerId() {
            return position == null ? 0L : position.ownerId();
        }

        @Override
        public int tileQ() {
            return position == null ? 0 : position.tile().q();
        }

        @Override
        public int tileR() {
            return position == null ? 0 : position.tile().r();
        }

        @Override
        public int tileLevel() {
            return position == null ? 0 : position.tile().level();
        }

        @Override
        public String headingName() {
            return position == null ? DungeonTravelHeading.defaultHeading().name() : position.heading().name();
        }

        @Override
        public String actionId() {
            return "";
        }
    }

    record MoveAction(
            @Nullable DungeonTravelPosition position,
            String actionId
    ) implements DungeonTravelCommand {

        public MoveAction {
            actionId = actionId == null ? "" : actionId;
        }

        @Override
        public int operationKey() {
            return MOVE_ACTION_OPERATION;
        }

        @Override
        public boolean hasPosition() {
            return position != null;
        }

        @Override
        public long mapIdValue() {
            return position == null ? 1L : position.mapId().value();
        }

        @Override
        public String locationKindName() {
            return position == null ? DungeonTravelLocationKind.TILE.name() : position.locationKind().name();
        }

        @Override
        public long ownerId() {
            return position == null ? 0L : position.ownerId();
        }

        @Override
        public int tileQ() {
            return position == null ? 0 : position.tile().q();
        }

        @Override
        public int tileR() {
            return position == null ? 0 : position.tile().r();
        }

        @Override
        public int tileLevel() {
            return position == null ? 0 : position.tile().level();
        }

        @Override
        public String headingName() {
            return position == null ? DungeonTravelHeading.defaultHeading().name() : position.heading().name();
        }
    }
}
