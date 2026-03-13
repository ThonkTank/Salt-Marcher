package features.world.dungeonmap.ui.runtime;

import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonRuntimeState;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.service.DungeonMoveResult;
import features.world.dungeonmap.service.DungeonMoveStatus;
import features.world.dungeonmap.service.DungeonRuntimeService;
import features.world.dungeonmap.ui.DungeonUiAsyncSupport;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonRuntimeApplicationService {

    public void loadMapList(Consumer<List<DungeonMap>> onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitValue(DungeonMapQueryService::getAllMaps, onSuccess, onError);
    }

    public void loadRuntimeState(Long requestedMapId, Consumer<DungeonRuntimeState> onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitValue(() -> DungeonRuntimeService.loadRuntimeState(requestedMapId), onSuccess, onError);
    }

    public void movePartyToEndpoint(
            long mapId,
            long endpointId,
            Consumer<features.world.dungeonmap.ui.DungeonMoveResult> onSuccess,
            Consumer<Throwable> onError
    ) {
        DungeonUiAsyncSupport.submitValue(
                () -> toDungeonMoveResult(DungeonRuntimeService.movePartyToEndpoint(mapId, endpointId)),
                onSuccess,
                onError);
    }

    private features.world.dungeonmap.ui.DungeonMoveResult toDungeonMoveResult(DungeonMoveResult result) {
        if (result == null) {
            return null;
        }
        return new features.world.dungeonmap.ui.DungeonMoveResult(
                switch (result.status()) {
                    case MOVED -> features.world.dungeonmap.ui.DungeonMoveStatus.MOVED;
                    case NOT_CONNECTED -> features.world.dungeonmap.ui.DungeonMoveStatus.NOT_CONNECTED;
                    case NO_CURRENT_POSITION -> features.world.dungeonmap.ui.DungeonMoveStatus.NO_CURRENT_POSITION;
                },
                result.endpointId());
    }
}
