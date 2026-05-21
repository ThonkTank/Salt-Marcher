package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public sealed interface DungeonTravelCommand permits
        DungeonTravelCommand.LoadSurface,
        DungeonTravelCommand.MoveAction {

    default boolean loadsSurface() {
        return false;
    }

    default long mapIdValue() {
        return 1L;
    }

    default String locationKindName() {
        return DungeonTravelLocationKind.TILE.name();
    }

    default long ownerId() {
        return 0L;
    }

    default int tileQ() {
        return 0;
    }

    default int tileR() {
        return 0;
    }

    default int tileLevel() {
        return 0;
    }

    default String headingName() {
        return DungeonTravelHeading.defaultHeading().name();
    }

    default String actionId() {
        return "";
    }

    record LoadSurface(@Nullable DungeonTravelPosition position) implements DungeonTravelCommand {

        @Override
        public boolean loadsSurface() {
            return true;
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

    record MoveAction(
            @Nullable DungeonTravelPosition position,
            String actionId
    ) implements DungeonTravelCommand {

        public MoveAction {
            actionId = actionId == null ? "" : actionId;
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
