package features.world.dungeonmap.shell.runtime;

import features.world.dungeonmap.canvas.base.DungeonCanvasInteractionHandler;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.DungeonRuntimeState;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.Objects;
import java.util.function.LongConsumer;

final class DungeonRuntimeInteractionController implements DungeonCanvasInteractionHandler {

    private final DungeonMapState mapState;
    private final DungeonRuntimeState runtimeState;
    private final LongConsumer moveHandler;

    DungeonRuntimeInteractionController(
            DungeonMapState mapState,
            DungeonRuntimeState runtimeState,
            LongConsumer moveHandler
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.runtimeState = Objects.requireNonNull(runtimeState, "runtimeState");
        this.moveHandler = Objects.requireNonNull(moveHandler, "moveHandler");
    }

    @Override
    public boolean handlePressed(DungeonCanvasPointerEvent event) {
        if (!interactionEnabled() || event == null) {
            return false;
        }
        Room room = mapState.activeMap().roomAtCell(event.gridCell());
        if (room == null || room.roomId() == null || !runtimeState.reachableRoomIds().contains(room.roomId())) {
            return false;
        }
        moveHandler.accept(room.roomId());
        return true;
    }

    @Override
    public boolean handleDragged(DungeonCanvasPointerEvent event) {
        return false;
    }

    @Override
    public boolean handleReleased(DungeonCanvasPointerEvent event) {
        return false;
    }

    private boolean interactionEnabled() {
        return !mapState.loading() && !runtimeState.loading() && !runtimeState.moving();
    }
}
