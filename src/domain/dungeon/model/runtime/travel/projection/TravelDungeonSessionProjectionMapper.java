package src.domain.dungeon.model.runtime.travel.projection;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.ContextKind;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.LocationKind;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.SurfaceData;

public final class TravelDungeonSessionProjectionMapper {

    private TravelDungeonSessionProjectionMapper() {
    }

    public static SurfaceData toRuntimeSurface(@Nullable TravelSurfaceFacts surface) {
        if (surface == null) {
            return TravelDungeonSessionSurface.outsideDungeonSurface(0L);
        }
        return new SurfaceData(
                ContextKind.DUNGEON,
                surface.mapName(),
                Math.toIntExact(Math.min(Integer.MAX_VALUE, surface.revision())),
                surface.map(),
                toRuntimePosition(surface.position()),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.visualDescription(),
                surface.actions().stream().map(TravelDungeonSessionProjectionMapper::toRuntimeAction).toList(),
                true);
    }

    public static @Nullable TravelPositionFacts toRuntimePositionFacts(@Nullable PositionData position) {
        if (position == null) {
            return null;
        }
        return new TravelPositionFacts(
                position.mapId(),
                LocationKind.fromName(position.locationKind().name()),
                position.ownerId(),
                position.tile(),
                position.heading());
    }

    private static TravelDungeonSessionSurface.AvailableAction toRuntimeAction(
            @Nullable TravelActionFacts action
    ) {
        return new TravelDungeonSessionSurface.AvailableAction(
                action == null ? "" : action.actionId(),
                action == null ? TravelActionKind.defaultKind() : action.kind(),
                action == null ? "" : action.label(),
                action == null ? "" : action.destinationLabel(),
                action == null ? "" : action.description());
    }

    private static PositionData toRuntimePosition(@Nullable TravelPositionFacts position) {
        return new PositionData(
                position == null ? 1L : position.mapId(),
                position == null
                        ? LocationKind.defaultKind()
                        : LocationKind.fromName(position.locationKind().name()),
                position == null ? 0L : position.ownerId(),
                position == null ? new Cell(0, 0, 0) : position.tile(),
                position == null ? TravelHeading.defaultHeading() : position.heading());
    }
}
