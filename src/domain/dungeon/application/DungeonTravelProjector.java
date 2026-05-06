package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonTravelActionFacts;
import src.domain.dungeon.map.value.DungeonTravelExternalTargetFacts;
import src.domain.dungeon.map.value.DungeonTravelMoveFacts;
import src.domain.dungeon.map.value.DungeonTravelPositionFacts;
import src.domain.dungeon.map.value.DungeonTravelSurfaceFacts;
import src.domain.dungeon.published.DungeonTravelActionKind;
import src.domain.dungeon.published.DungeonTravelActionSnapshot;
import src.domain.dungeon.published.DungeonTravelContextKind;
import src.domain.dungeon.published.DungeonTravelExternalTarget;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.domain.dungeon.published.DungeonTravelLocationKind;
import src.domain.dungeon.published.DungeonTravelMoveResult;
import src.domain.dungeon.published.DungeonTravelMoveStatus;
import src.domain.dungeon.published.DungeonTravelPosition;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;

public final class DungeonTravelProjector {

    private DungeonTravelProjector() {
    }

    public static DungeonTravelSurfaceSnapshot surface(DungeonTravelSurfaceFacts surface) {
        return new DungeonTravelSurfaceSnapshot(
                DungeonTravelContextKind.DUNGEON,
                surface.mapName(),
                DungeonIdentityBoundaryTranslator.revision(surface.revision()),
                DungeonMapProjector.snapshot(surface.map()),
                position(surface.position()),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.visualDescription(),
                surface.actions().stream().map(DungeonTravelProjector::action).toList());
    }

    public static DungeonTravelMoveResult move(DungeonTravelMoveFacts result) {
        return new DungeonTravelMoveResult(
                DungeonTravelMoveStatus.valueOf(result.status().name()),
                result.message(),
                surface(result.surface()),
                externalTarget(result.externalTarget()));
    }

    public static @Nullable DungeonTravelPositionFacts domainPosition(@Nullable DungeonTravelPosition position) {
        if (position == null) {
            return null;
        }
        return new DungeonTravelPositionFacts(
                DungeonIdentityBoundaryTranslator.domainId(position.mapId()),
                src.domain.dungeon.map.value.DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                position.ownerId(),
                DungeonCellEdgeBoundaryTranslator.domainCell(position.tile()),
                src.domain.dungeon.map.value.DungeonTravelHeading.valueOf(position.heading().name()));
    }

    private static DungeonTravelActionSnapshot action(DungeonTravelActionFacts action) {
        return new DungeonTravelActionSnapshot(
                action.actionId(),
                DungeonTravelActionKind.valueOf(action.kind().name()),
                action.label(),
                action.destinationLabel(),
                action.description());
    }

    private static @Nullable DungeonTravelExternalTarget externalTarget(
            @Nullable DungeonTravelExternalTargetFacts externalTarget
    ) {
        if (externalTarget instanceof DungeonTravelExternalTargetFacts.OverworldTile overworld) {
            return new DungeonTravelExternalTarget.OverworldTile(overworld.mapId(), overworld.tileId());
        }
        return null;
    }

    private static DungeonTravelPosition position(DungeonTravelPositionFacts position) {
        return new DungeonTravelPosition(
                DungeonIdentityBoundaryTranslator.id(position.mapId()),
                DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                position.ownerId(),
                DungeonCellEdgeBoundaryTranslator.cell(position.tile()),
                DungeonTravelHeading.valueOf(position.heading().name()));
    }
}
