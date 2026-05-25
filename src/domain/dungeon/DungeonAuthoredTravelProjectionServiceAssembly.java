package src.domain.dungeon;

import java.util.List;

final class DungeonAuthoredTravelProjectionServiceAssembly {

    private DungeonAuthoredTravelProjectionServiceAssembly() {
    }

    static src.domain.dungeon.published.DungeonTravelResponse defaultTravel() {
        String defaultDungeonName = "Dungeon";
        return new src.domain.dungeon.published.DungeonTravelResponse.Surface(
                new src.domain.dungeon.published.DungeonTravelSurfaceSnapshot(
                        src.domain.dungeon.published.DungeonTravelContextKind.DUNGEON,
                        defaultDungeonName,
                        0,
                        src.domain.dungeon.published.DungeonMapSnapshot.empty(),
                        new src.domain.dungeon.published.DungeonTravelPosition(
                                new src.domain.dungeon.published.DungeonMapId(1L),
                                src.domain.dungeon.published.DungeonTravelLocationKind.TILE,
                                0L,
                                new src.domain.dungeon.published.DungeonCellRef(0, 0, 0),
                                src.domain.dungeon.published.DungeonTravelHeading.defaultHeading()),
                        defaultDungeonName,
                        "Kein Standort",
                        "",
                        "",
                        "",
                        "",
                        List.of()));
    }

    static src.domain.dungeon.published.DungeonTravelResponse surface(
            src.domain.dungeon.model.worldspace.model.DungeonTravelSurfaceFacts surface
    ) {
        return new src.domain.dungeon.published.DungeonTravelResponse.Surface(surfaceSnapshot(surface));
    }

    static src.domain.dungeon.published.DungeonTravelResponse move(
            src.domain.dungeon.model.worldspace.model.DungeonTravelMoveFacts move
    ) {
        return new src.domain.dungeon.published.DungeonTravelResponse.Move(
                new src.domain.dungeon.published.DungeonTravelMoveResult(
                        src.domain.dungeon.published.DungeonTravelMoveStatus.valueOf(move.status().name()),
                        move.message(),
                        surfaceSnapshot(move.surface()),
                        externalTarget(move.externalTarget())));
    }

    private static src.domain.dungeon.published.DungeonTravelSurfaceSnapshot surfaceSnapshot(
            src.domain.dungeon.model.worldspace.model.DungeonTravelSurfaceFacts surface
    ) {
        return new src.domain.dungeon.published.DungeonTravelSurfaceSnapshot(
                src.domain.dungeon.published.DungeonTravelContextKind.DUNGEON,
                surface.mapName(),
                DungeonPublishedMapProjectionServiceAssembly.revision(surface.revision()),
                DungeonPublishedMapProjectionServiceAssembly.mapSnapshot(surface.map(), List.of()),
                travelPosition(surface.position()),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.visualDescription(),
                surface.actions().stream().map(DungeonAuthoredTravelProjectionServiceAssembly::travelAction).toList());
    }

    private static src.domain.dungeon.published.DungeonTravelActionSnapshot travelAction(
            src.domain.dungeon.model.worldspace.model.DungeonTravelActionFacts action
    ) {
        return new src.domain.dungeon.published.DungeonTravelActionSnapshot(
                action.actionId(),
                src.domain.dungeon.published.DungeonTravelActionKind.valueOf(action.kind().name()),
                action.label(),
                action.destinationLabel(),
                action.description());
    }

    private static src.domain.dungeon.published.DungeonTravelPosition travelPosition(
            src.domain.dungeon.model.worldspace.model.DungeonTravelPositionFacts position
    ) {
        return new src.domain.dungeon.published.DungeonTravelPosition(
                id(position.mapId()),
                src.domain.dungeon.published.DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                position.ownerId(),
                DungeonPublishedMapProjectionServiceAssembly.cell(position.tile()),
                src.domain.dungeon.published.DungeonTravelHeading.valueOf(position.heading().name()));
    }

    private static src.domain.dungeon.published.DungeonTravelExternalTarget externalTarget(
            src.domain.dungeon.model.worldspace.model.DungeonTravelExternalTargetFacts target
    ) {
        if (target != null && target.isOverworldTile()) {
            return new src.domain.dungeon.published.DungeonTravelExternalTarget.OverworldTile(target.mapId(), target.tileId());
        }
        return null;
    }

    private static src.domain.dungeon.published.DungeonMapId id(
            src.domain.dungeon.model.worldspace.model.DungeonMapIdentity identity
    ) {
        return new src.domain.dungeon.published.DungeonMapId(identity == null ? 1L : identity.value());
    }
}
