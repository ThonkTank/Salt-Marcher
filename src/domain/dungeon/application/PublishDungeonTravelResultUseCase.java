package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonTravelExternalTargetFacts;
import src.domain.dungeon.model.map.model.DungeonTravelMoveFacts;
import src.domain.dungeon.published.DungeonTravelExternalTarget;
import src.domain.dungeon.published.DungeonTravelMoveResult;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;

public final class PublishDungeonTravelResultUseCase {

    private final PublishDungeonTravelSurfaceUseCase surfaceUseCase = new PublishDungeonTravelSurfaceUseCase();

    public DungeonTravelSurfaceSnapshot travelSurface(src.domain.dungeon.model.map.model.DungeonTravelSurfaceFacts surface) {
        return surfaceUseCase.surface(surface);
    }

    public DungeonTravelMoveResult travelMoveResult(DungeonTravelMoveFacts result) {
        return new DungeonTravelMoveResult(
                src.domain.dungeon.published.DungeonTravelMoveStatus.valueOf(result.status().name()),
                result.message(),
                travelSurface(result.surface()),
                travelExternalTarget(result.externalTarget()));
    }

    private @Nullable DungeonTravelExternalTarget travelExternalTarget(
            @Nullable DungeonTravelExternalTargetFacts externalTarget
    ) {
        if (externalTarget instanceof DungeonTravelExternalTargetFacts.OverworldTile overworld) {
            return new DungeonTravelExternalTarget.OverworldTile(overworld.mapId(), overworld.tileId());
        }
        return null;
    }
}
