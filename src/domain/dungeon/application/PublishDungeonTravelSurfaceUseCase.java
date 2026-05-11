package src.domain.dungeon.application;

import src.domain.dungeon.model.map.model.DungeonTravelActionFacts;
import src.domain.dungeon.model.map.model.DungeonTravelPositionFacts;
import src.domain.dungeon.model.map.model.DungeonTravelSurfaceFacts;
import src.domain.dungeon.published.DungeonTravelActionSnapshot;
import src.domain.dungeon.published.DungeonTravelContextKind;
import src.domain.dungeon.published.DungeonTravelPosition;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;

final class PublishDungeonTravelSurfaceUseCase {

    private final PublishDungeonTravelMapSnapshotUseCase mapSnapshotUseCase =
            new PublishDungeonTravelMapSnapshotUseCase();

    DungeonTravelSurfaceSnapshot surface(DungeonTravelSurfaceFacts surface) {
        return new DungeonTravelSurfaceSnapshot(
                DungeonTravelContextKind.DUNGEON,
                surface.mapName(),
                PublishDungeonTravelScalarUseCase.revision(surface.revision()),
                mapSnapshotUseCase.mapSnapshot(surface.map()),
                travelPosition(surface.position()),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.visualDescription(),
                surface.actions().stream().map(this::travelAction).toList());
    }

    private DungeonTravelActionSnapshot travelAction(DungeonTravelActionFacts action) {
        return new DungeonTravelActionSnapshot(
                action.actionId(),
                src.domain.dungeon.published.DungeonTravelActionKind.valueOf(action.kind().name()),
                action.label(),
                action.destinationLabel(),
                action.description());
    }

    private DungeonTravelPosition travelPosition(DungeonTravelPositionFacts position) {
        return new DungeonTravelPosition(
                PublishDungeonTravelRefUseCase.id(position.mapId()),
                src.domain.dungeon.published.DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                position.ownerId(),
                PublishDungeonTravelRefUseCase.cell(position.tile()),
                src.domain.dungeon.published.DungeonTravelHeading.valueOf(position.heading().name()));
    }
}
