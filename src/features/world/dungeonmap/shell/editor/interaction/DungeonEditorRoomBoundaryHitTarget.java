package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.Objects;

public record DungeonEditorRoomBoundaryHitTarget(
        Room room,
        VertexEdge edge,
        Point2i roomCell,
        Point2i outwardStep,
        boolean exterior,
        long priority
) implements DungeonEditorHitTarget {

    public DungeonEditorRoomBoundaryHitTarget {
        room = Objects.requireNonNull(room, "room");
        edge = Objects.requireNonNull(edge, "edge");
        roomCell = Objects.requireNonNull(roomCell, "roomCell");
        outwardStep = Objects.requireNonNull(outwardStep, "outwardStep");
    }

    @Override
    public String targetKey() {
        return room.targetKey();
    }

    @Override
    public Long clusterId() {
        return room.clusterId();
    }

    @Override
    public Long roomId() {
        return room.roomId();
    }
}
