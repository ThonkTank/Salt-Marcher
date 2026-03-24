package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.structures.room.Room;

import java.util.Objects;

public record DungeonEditorRoomHitTarget(
        Room room,
        long priority
) implements DungeonEditorHitTarget {

    public DungeonEditorRoomHitTarget {
        room = Objects.requireNonNull(room, "room");
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
