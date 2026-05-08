package src.domain.travel.application;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonTravelActionSnapshot;
import src.domain.dungeon.published.DungeonTravelExternalTarget;
import src.domain.dungeon.published.DungeonTravelMoveResult;
import src.domain.dungeon.published.DungeonTravelPosition;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;

public final class TravelDungeonSurfaceProjector {

    private TravelDungeonSurfaceProjector() {
    }

    public static ApplyTravelDungeonSessionUseCase.SurfaceData toInternalSurface(
            @Nullable DungeonTravelSurfaceSnapshot surface
    ) {
        if (surface == null) {
            return outsideDungeonSurfaceData(0L);
        }
        return new ApplyTravelDungeonSessionUseCase.SurfaceData(
                ApplyTravelDungeonSessionUseCase.ContextKind.valueOf(surface.contextKind().name()),
                surface.mapName(),
                surface.revision(),
                TravelDungeonMapDataProjector.toInternalMap(surface.map()),
                toInternalPosition(surface.position()),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.visualDescription(),
                surface.actions().stream().map(TravelDungeonSurfaceProjector::toInternalAction).toList());
    }

    public static ApplyTravelDungeonSessionUseCase.MoveResultData toInternalMoveResult(
            @Nullable DungeonTravelMoveResult result
    ) {
        if (result == null) {
            return new ApplyTravelDungeonSessionUseCase.MoveResultData(
                    ApplyTravelDungeonSessionUseCase.MoveStatus.NO_MAP,
                    outsideDungeonSurfaceData(0L),
                    null);
        }
        ApplyTravelDungeonSessionUseCase.OverworldTargetData externalTarget =
                result.externalTarget() instanceof DungeonTravelExternalTarget.OverworldTile overworld
                        ? new ApplyTravelDungeonSessionUseCase.OverworldTargetData(
                        overworld.mapId(),
                        overworld.tileId())
                        : null;
        return new ApplyTravelDungeonSessionUseCase.MoveResultData(
                ApplyTravelDungeonSessionUseCase.MoveStatus.valueOf(result.status().name()),
                toInternalSurface(result.surface()),
                externalTarget);
    }

    public static ApplyTravelDungeonSessionUseCase.AvailableAction toInternalAction(
            @Nullable DungeonTravelActionSnapshot action
    ) {
        return new ApplyTravelDungeonSessionUseCase.AvailableAction(
                action == null ? "" : action.actionId(),
                action == null ? "" : action.displayLabel(),
                action == null ? "" : action.description());
    }

    public static ApplyTravelDungeonSessionUseCase.PositionData toInternalPosition(@Nullable DungeonTravelPosition position) {
        return new ApplyTravelDungeonSessionUseCase.PositionData(
                position == null ? 1L : position.mapId().value(),
                position == null
                        ? ApplyTravelDungeonSessionUseCase.LocationKind.TILE
                        : ApplyTravelDungeonSessionUseCase.LocationKind.valueOf(position.locationKind().name()),
                position == null ? 0L : position.ownerId(),
                new ApplyTravelDungeonSessionUseCase.CellData(
                        position == null ? 0 : position.tile().q(),
                        position == null ? 0 : position.tile().r(),
                        position == null ? 0 : position.tile().level()),
                position == null
                        ? ApplyTravelDungeonSessionUseCase.Direction.defaultDirection()
                        : ApplyTravelDungeonSessionUseCase.Direction.fromName(position.heading().name()));
    }

    public static @Nullable DungeonTravelPosition toDungeonPosition(
            ApplyTravelDungeonSessionUseCase.@Nullable PositionData position
    ) {
        if (position == null) {
            return null;
        }
        return new DungeonTravelPosition(
                new src.domain.dungeon.published.DungeonMapId(position.mapId()),
                src.domain.dungeon.published.DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                position.ownerId(),
                new DungeonCellRef(position.tile().q(), position.tile().r(), position.tile().level()),
                src.domain.dungeon.published.DungeonTravelHeading.valueOf(position.heading().name()));
    }

    public static ApplyTravelDungeonSessionUseCase.SurfaceData outsideDungeonSurfaceData(long tileId) {
        return new ApplyTravelDungeonSessionUseCase.SurfaceData(
                ApplyTravelDungeonSessionUseCase.ContextKind.OVERWORLD,
                "Overworld",
                0,
                ApplyTravelDungeonSessionUseCase.MapData.empty(),
                new ApplyTravelDungeonSessionUseCase.PositionData(
                        1L,
                        ApplyTravelDungeonSessionUseCase.LocationKind.TILE,
                        0L,
                        new ApplyTravelDungeonSessionUseCase.CellData(0, 0, 0),
                        ApplyTravelDungeonSessionUseCase.Direction.defaultDirection()),
                "Overworld",
                "Overworld-Feld " + tileId,
                "-",
                "-",
                "Gruppe befindet sich ausserhalb des Dungeons",
                "",
                List.of());
    }
}
