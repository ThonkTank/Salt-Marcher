package features.dungeon.application.authored.command;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.room.DungeonRoomExitDescription;
import features.dungeon.domain.core.structure.room.DungeonRoomNarration;
import features.dungeon.domain.core.structure.room.RoomRegion;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/** Exact before/after delta for one stable authored room. */
public record RoomRegionChange(RoomRegion before, RoomRegion after) implements DungeonPatchChange {
    private static final long FIXED_ENCODING_BYTES = 128L;
    private static final long CELL_ENCODING_BYTES = 16L;

    public RoomRegionChange {
        if (before == null || after == null || before.equals(after)) {
            throw new IllegalArgumentException("a room semantic change requires distinct before and after state");
        }
        if (before.roomId() != after.roomId()
                || before.mapId() != after.mapId()
                || before.clusterId() != after.clusterId()) {
            throw new IllegalArgumentException("room identity and cluster membership must remain stable");
        }
    }

    @Override
    public DungeonMapIdentity mapId() {
        return new DungeonMapIdentity(after.mapId());
    }

    @Override
    public DungeonPatchEntityRef entityRef() {
        return DungeonPatchEntityRef.room(after.roomId());
    }

    @Override
    public Set<DungeonChunkKey> touchedChunks() {
        Set<DungeonChunkKey> result = new LinkedHashSet<>();
        addChunks(result, before);
        addChunks(result, after);
        return Set.copyOf(result);
    }

    @Override
    public long encodedBytes() {
        return FIXED_ENCODING_BYTES + encodedBytes(before) + encodedBytes(after);
    }

    @Override
    public RoomRegionChange inverse() {
        return new RoomRegionChange(after, before);
    }

    private static void addChunks(Set<DungeonChunkKey> result, RoomRegion room) {
        for (Cell cell : room.floorCells()) {
            result.add(new DungeonChunkKey(
                    room.mapId(),
                    cell.level(),
                    Math.floorDiv(cell.q(), DungeonChunkKey.CHUNK_SIZE),
                    Math.floorDiv(cell.r(), DungeonChunkKey.CHUNK_SIZE)));
        }
    }

    private static long encodedBytes(RoomRegion room) {
        return CELL_ENCODING_BYTES * room.floorCells().size()
                + textBytes(room.name())
                + narrationBytes(room.narration());
    }

    private static long narrationBytes(DungeonRoomNarration narration) {
        long result = textBytes(narration.visualDescription());
        for (DungeonRoomExitDescription exit : narration.exitDescriptions()) {
            result += CELL_ENCODING_BYTES + textBytes(exit.description());
        }
        return result;
    }

    private static long textBytes(String value) {
        return Objects.requireNonNullElse(value, "").getBytes(StandardCharsets.UTF_8).length;
    }
}
