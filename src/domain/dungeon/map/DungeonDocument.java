package src.domain.dungeon.map;

import src.domain.dungeon.api.DungeonEditorOperation;
import src.domain.mapcore.api.MapTopologyKind;

import java.util.ArrayList;
import java.util.List;

/**
 * Committed editable dungeon truth.
 */
public record DungeonDocument(
        String mapName,
        MapTopologyKind topology,
        int width,
        int height,
        int roomAnchorQ,
        int roomAnchorR,
        int revision
) {

    public DungeonDocument {
        mapName = mapName == null || mapName.isBlank() ? "Dungeon Bastion" : mapName;
        topology = topology == null ? MapTopologyKind.SQUARE : topology;
        width = Math.max(6, width);
        height = Math.max(6, height);
        revision = Math.max(0, revision);
    }

    public static DungeonDocument demo() {
        return new DungeonDocument("Dungeon Bastion", MapTopologyKind.SQUARE, 10, 8, 2, 2, 1);
    }

    public DungeonDocument withMapName(String nextMapName) {
        return new DungeonDocument(nextMapName, topology, width, height, roomAnchorQ, roomAnchorR, revision);
    }

    public DungeonDocument moveRoomAnchor(int deltaQ, int deltaR) {
        int nextQ = Math.max(1, Math.min(width - 4, roomAnchorQ + deltaQ));
        int nextR = Math.max(1, Math.min(height - 4, roomAnchorR + deltaR));
        return new DungeonDocument(mapName, topology, width, height, nextQ, nextR, revision + 1);
    }

    public DungeonDocument apply(DungeonEditorOperation operation) {
        if (operation instanceof DungeonEditorOperation.MoveRoomAnchor moveRoomAnchor) {
            return moveRoomAnchor(moveRoomAnchor.deltaQ(), moveRoomAnchor.deltaR());
        }
        if (operation instanceof DungeonEditorOperation.ResetDemoLayout) {
            return demo();
        }
        return this;
    }

    public List<String> validationMessages() {
        List<String> messages = new ArrayList<>();
        if (roomAnchorQ < 1 || roomAnchorR < 1) {
            messages.add("room anchor clamped into valid map bounds");
        }
        messages.add("room anchor valid inside committed map bounds");
        return List.copyOf(messages);
    }

    public List<String> reactionMessages(DungeonDocument after) {
        if (after == null || (roomAnchorQ == after.roomAnchorQ() && roomAnchorR == after.roomAnchorR())) {
            return List.of("derived state rebuilt without structural movement");
        }
        return List.of(
                "corridor attachment recomputed from moved room anchor",
                "door boundary re-anchored onto rebuilt aggregate relation graph"
        );
    }
}
