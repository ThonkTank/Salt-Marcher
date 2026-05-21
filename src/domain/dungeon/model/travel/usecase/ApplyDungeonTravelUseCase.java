package src.domain.dungeon.model.travel.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTravelHeading;
import src.domain.dungeon.model.map.model.DungeonTravelLocationKind;
import src.domain.dungeon.model.map.model.DungeonTravelMoveFacts;
import src.domain.dungeon.model.map.model.DungeonTravelPositionFacts;
import src.domain.dungeon.model.map.model.DungeonTravelSurfaceFacts;

public final class ApplyDungeonTravelUseCase {

    private final LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase;
    private final MoveDungeonTravelActionUseCase moveDungeonTravelActionUseCase;

    public ApplyDungeonTravelUseCase(
            LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase,
            MoveDungeonTravelActionUseCase moveDungeonTravelActionUseCase
    ) {
        this.loadDungeonTravelSurfaceUseCase =
                Objects.requireNonNull(loadDungeonTravelSurfaceUseCase, "loadDungeonTravelSurfaceUseCase");
        this.moveDungeonTravelActionUseCase =
                Objects.requireNonNull(moveDungeonTravelActionUseCase, "moveDungeonTravelActionUseCase");
    }

    public DungeonTravelSurfaceFacts loadSurface(@Nullable DungeonTravelPositionFacts position) {
        return loadDungeonTravelSurfaceUseCase.execute(new LoadDungeonTravelSurfaceUseCase.Input(position));
    }

    public DungeonTravelMoveFacts move(@Nullable DungeonTravelPositionFacts position, String actionId) {
        return moveDungeonTravelActionUseCase.execute(new MoveDungeonTravelActionUseCase.Input(position, actionId));
    }

    public record PositionInput(
            MapInput map,
            LocationKindInput locationKind,
            long ownerId,
            CellInput tile,
            HeadingInput heading
    ) {

        public PositionInput {
            map = map == null ? new MapInput(1L) : map;
            locationKind = locationKind == null ? LocationKindInput.TILE : locationKind;
            ownerId = Math.max(0L, ownerId);
            tile = tile == null ? new CellInput(0, 0, 0) : tile;
            heading = heading == null ? HeadingInput.SOUTH : heading;
        }

        DungeonTravelPositionFacts toFacts() {
            return new DungeonTravelPositionFacts(
                    new DungeonMapIdentity(map.value()),
                    locationKind.toModelKind(),
                    ownerId,
                    new DungeonCell(tile.q(), tile.r(), tile.level()),
                    heading.toModelHeading());
        }
    }

    public record MapInput(long value) {
    }

    public record CellInput(int q, int r, int level) {
    }

    public enum LocationKindInput {
        TILE,
        STAIR_EXIT,
        TRANSITION;

        private DungeonTravelLocationKind toModelKind() {
            return switch (this) {
                case STAIR_EXIT -> DungeonTravelLocationKind.STAIR_EXIT;
                case TRANSITION -> DungeonTravelLocationKind.TRANSITION;
                case TILE -> DungeonTravelLocationKind.TILE;
            };
        }
    }

    public enum HeadingInput {
        NORTH,
        EAST,
        SOUTH,
        WEST;

        private DungeonTravelHeading toModelHeading() {
            return switch (this) {
                case NORTH -> DungeonTravelHeading.NORTH;
                case EAST -> DungeonTravelHeading.EAST;
                case WEST -> DungeonTravelHeading.WEST;
                case SOUTH -> DungeonTravelHeading.SOUTH;
            };
        }
    }
}
