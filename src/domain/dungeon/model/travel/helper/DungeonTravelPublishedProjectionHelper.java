package src.domain.dungeon.model.travel.helper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.helper.DungeonPublishedMapSnapshotProjectionHelper;
import src.domain.dungeon.model.map.helper.DungeonPublishedStateValueHelper;
import src.domain.dungeon.model.map.model.DungeonTravelActionFacts;
import src.domain.dungeon.model.map.model.DungeonTravelExternalTargetFacts;
import src.domain.dungeon.model.map.model.DungeonTravelMoveFacts;
import src.domain.dungeon.model.map.model.DungeonTravelPositionFacts;
import src.domain.dungeon.model.map.model.DungeonTravelSurfaceFacts;
import src.domain.dungeon.published.DungeonTravelActionKind;
import src.domain.dungeon.published.DungeonTravelActionSnapshot;
import src.domain.dungeon.published.DungeonTravelContextKind;
import src.domain.dungeon.published.DungeonTravelExternalTarget;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.domain.dungeon.published.DungeonTravelLocationKind;
import src.domain.dungeon.published.DungeonTravelMoveResult;
import src.domain.dungeon.published.DungeonTravelMoveStatus;
import src.domain.dungeon.published.DungeonTravelPosition;
import src.domain.dungeon.published.DungeonTravelResponse;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;

public final class DungeonTravelPublishedProjectionHelper {

    private final DungeonPublishedMapSnapshotProjectionHelper mapProjectionHelper;

    public DungeonTravelPublishedProjectionHelper(DungeonPublishedMapSnapshotProjectionHelper mapProjectionHelper) {
        this.mapProjectionHelper = mapProjectionHelper;
    }

    public DungeonTravelResponse surface(DungeonTravelSurfaceFacts surface) {
        return new DungeonTravelResponse.Surface(surfaceSnapshot(surface));
    }

    public DungeonTravelResponse move(DungeonTravelMoveFacts result) {
        return new DungeonTravelResponse.Move(new DungeonTravelMoveResult(
                DungeonTravelMoveStatus.valueOf(result.status().name()),
                result.message(),
                surfaceSnapshot(result.surface()),
                externalTarget(result.externalTarget())));
    }

    private DungeonTravelSurfaceSnapshot surfaceSnapshot(DungeonTravelSurfaceFacts surface) {
        return new DungeonTravelSurfaceSnapshot(
                DungeonTravelContextKind.DUNGEON,
                surface.mapName(),
                DungeonPublishedStateValueHelper.revision(surface.revision()),
                mapProjectionHelper.snapshot(surface.map(), List.of()),
                travelPosition(surface.position()),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.visualDescription(),
                surface.actions().stream().map(DungeonTravelPublishedProjectionHelper::travelAction).toList());
    }

    private static DungeonTravelActionSnapshot travelAction(DungeonTravelActionFacts action) {
        return new DungeonTravelActionSnapshot(
                action.actionId(),
                DungeonTravelActionKind.valueOf(action.kind().name()),
                action.label(),
                action.destinationLabel(),
                action.description());
    }

    private static DungeonTravelPosition travelPosition(DungeonTravelPositionFacts position) {
        return new DungeonTravelPosition(
                DungeonPublishedStateValueHelper.id(position.mapId()),
                DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                position.ownerId(),
                DungeonPublishedStateValueHelper.cell(position.tile()),
                DungeonTravelHeading.valueOf(position.heading().name()));
    }

    private static @Nullable DungeonTravelExternalTarget externalTarget(
            @Nullable DungeonTravelExternalTargetFacts externalTarget
    ) {
        if (externalTarget != null && externalTarget.isOverworldTile()) {
            return new DungeonTravelExternalTarget.OverworldTile(externalTarget.mapId(), externalTarget.tileId());
        }
        return null;
    }
}
