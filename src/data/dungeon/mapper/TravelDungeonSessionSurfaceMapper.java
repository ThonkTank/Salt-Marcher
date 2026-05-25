package src.data.dungeon.mapper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.model.DungeonCell;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionMovement.MoveResultData;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.AvailableAction;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.MapData;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionValues.ContextKind;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionValues.LocationKind;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionValues.MoveStatus;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionValues.OverworldTarget;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonTravelActionSnapshot;
import src.domain.dungeon.published.DungeonTravelExternalTarget;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.domain.dungeon.published.DungeonTravelLocationKind;
import src.domain.dungeon.published.DungeonTravelMoveResult;
import src.domain.dungeon.published.DungeonTravelPosition;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;

public final class TravelDungeonSessionSurfaceMapper {

    private TravelDungeonSessionSurfaceMapper() {
    }

    public static SurfaceData toInternalSurface(@Nullable DungeonTravelSurfaceSnapshot surface) {
        if (surface == null) {
            return outsideDungeonSurfaceData(0L);
        }
        return new SurfaceData(
                ContextKind.valueOf(surface.contextKind().name()),
                surface.mapName(),
                surface.revision(),
                TravelDungeonSessionMapMapper.toInternalMap(surface.map()),
                toInternalPosition(surface.position()),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.visualDescription(),
                surface.actions().stream().map(TravelDungeonSessionSurfaceMapper::toInternalAction).toList());
    }

    public static MoveResultData toInternalMoveResult(@Nullable DungeonTravelMoveResult result) {
        if (result == null) {
            return new MoveResultData(
                    MoveStatus.NO_MAP,
                    outsideDungeonSurfaceData(0L),
                    null);
        }
        OverworldTarget externalTarget =
                result.externalTarget() instanceof DungeonTravelExternalTarget.OverworldTile overworld
                        ? new OverworldTarget(
                                overworld.mapId(),
                                overworld.tileId())
                        : null;
        return new MoveResultData(
                MoveStatus.valueOf(result.status().name()),
                toInternalSurface(result.surface()),
                externalTarget);
    }

    public static @Nullable DungeonTravelPosition toDungeonPosition(@Nullable PositionData position) {
        if (position == null) {
            return null;
        }
        return new DungeonTravelPosition(
                new DungeonMapId(position.mapId()),
                DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                position.ownerId(),
                new DungeonCellRef(position.tile().q(), position.tile().r(), position.tile().level()),
                toDungeonHeading(position.headingToken()));
    }

    private static AvailableAction toInternalAction(@Nullable DungeonTravelActionSnapshot action) {
        return new AvailableAction(
                action == null ? "" : action.actionId(),
                action == null ? "" : action.displayLabel(),
                action == null ? "" : action.description());
    }

    private static PositionData toInternalPosition(@Nullable DungeonTravelPosition position) {
        return new PositionData(
                position == null ? 1L : position.mapId().value(),
                position == null
                        ? LocationKind.TILE
                        : LocationKind.valueOf(position.locationKind().name()),
                position == null ? 0L : position.ownerId(),
                new DungeonCell(
                        position == null ? 0 : position.tile().q(),
                        position == null ? 0 : position.tile().r(),
                        position == null ? 0 : position.tile().level()),
                position == null ? "SOUTH" : position.heading().name());
    }

    private static SurfaceData outsideDungeonSurfaceData(long tileId) {
        return new SurfaceData(
                ContextKind.OVERWORLD,
                "Overworld",
                0,
                MapData.empty(),
                new PositionData(
                        1L,
                        LocationKind.TILE,
                        0L,
                        new DungeonCell(0, 0, 0),
                        "SOUTH"),
                "Overworld",
                "Overworld-Feld " + tileId,
                "-",
                "-",
                "Gruppe befindet sich ausserhalb des Dungeons",
                "",
                List.of());
    }

    private static DungeonTravelHeading toDungeonHeading(@Nullable String headingToken) {
        return switch (headingToken == null ? "" : headingToken.trim()) {
            case "NORTH" -> DungeonTravelHeading.NORTH;
            case "EAST" -> DungeonTravelHeading.EAST;
            case "WEST" -> DungeonTravelHeading.WEST;
            default -> DungeonTravelHeading.SOUTH;
        };
    }
}
