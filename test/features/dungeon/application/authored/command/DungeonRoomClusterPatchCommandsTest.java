package features.dungeon.application.authored.command;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.room.DungeonRoomExitDescription;
import features.dungeon.domain.core.structure.room.DungeonRoomNarration;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomRegion;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

final class DungeonRoomClusterPatchCommandsTest {

    @Test
    void roomNamePatchPreservesIdentityAndAppliesExactInverse() {
        DungeonMap current = mapWithRoom();
        RoomRegion before = current.rooms().rooms().getFirst();

        DungeonCommandResult.Accepted accepted = assertInstanceOf(
                DungeonCommandResult.Accepted.class,
                new RoomNameCommand().plan(current, before.roomId(), "  Blaue Kammer  "));

        assertEquals(
                DungeonPatchEntityRef.room(before.roomId()),
                accepted.patch().resultFacts().affectedEntities().getFirst());
        assertEquals(Set.of(new DungeonChunkKey(93L, 0, 0, 0)), accepted.patch().touchedChunks());
        DungeonMap renamed = accepted.patch().applyTo(current);
        RoomRegion after = renamed.rooms().findRoom(before.roomId()).orElseThrow();
        assertEquals("Blaue Kammer", after.name());
        assertEquals(before.clusterId(), after.clusterId());
        assertEquals(before.floorCells(), after.floorCells());
        assertEquals(current.revision() + 1L, renamed.revision());

        DungeonMap restored = accepted.inverse().applyTo(renamed);
        assertEquals(before, restored.rooms().findRoom(before.roomId()).orElseThrow());
        assertEquals(current.revision() + 2L, restored.revision());
        assertThrows(IllegalArgumentException.class, () -> accepted.patch().applyTo(renamed));
    }

    @Test
    void roomNarrationPatchCarriesFullSemanticStateAndInverse() {
        DungeonMap current = mapWithRoom();
        RoomRegion before = current.rooms().rooms().getFirst();
        DungeonRoomNarration narration = new DungeonRoomNarration(
                "Kühle Luft",
                List.of(new DungeonRoomExitDescription(
                        before.primaryAnchor(),
                        Direction.NORTH,
                        "Schwere Tür")));

        DungeonCommandResult.Accepted accepted = assertInstanceOf(
                DungeonCommandResult.Accepted.class,
                new RoomNarrationCommand().plan(current, before.roomId(), narration));
        assertTrue(accepted.patch().encodedBytes() >= "Kühle LuftSchwere Tür".getBytes(
                java.nio.charset.StandardCharsets.UTF_8).length);

        DungeonMap narrated = accepted.patch().applyTo(current);
        assertEquals(narration, narrated.rooms().findRoom(before.roomId()).orElseThrow().narration());
        DungeonMap restored = accepted.inverse().applyTo(narrated);
        assertEquals(before, restored.rooms().findRoom(before.roomId()).orElseThrow());
    }

    @Test
    void clusterNamePatchUsesClusterIdentityWithoutInventingTopologyRef() {
        DungeonMap current = mapWithRoom();
        RoomCluster before = current.topology().roomClusters().getFirst();

        DungeonCommandResult.Accepted accepted = assertInstanceOf(
                DungeonCommandResult.Accepted.class,
                new RoomClusterNameCommand().plan(current, before.clusterId(), "  Nordflügel  "));
        DungeonPatchEntityRef entityRef = accepted.patch().resultFacts().affectedEntities().getFirst();
        assertEquals(DungeonPatchEntityRef.Kind.ROOM_CLUSTER, entityRef.kind());
        assertEquals(before.clusterId(), entityRef.id());
        assertNull(entityRef.topologyRef());
        assertThrows(IllegalArgumentException.class, () -> new DungeonPatchEntityRef(
                DungeonPatchEntityRef.Kind.ROOM_CLUSTER,
                before.clusterId(),
                DungeonPatchEntityRef.room(before.clusterId()).topologyRef()));
        assertEquals(Set.of(new DungeonChunkKey(93L, 0, 0, 0)), accepted.patch().touchedChunks());

        DungeonMap renamed = accepted.patch().applyTo(current);
        assertEquals("Nordflügel", renamed.topology().roomCluster(before.clusterId()).name());
        DungeonMap restored = accepted.inverse().applyTo(renamed);
        assertEquals(before, restored.topology().roomCluster(before.clusterId()));
    }

    @Test
    void missingAndNoEffectRoomClusterCommandsRejectWithoutMutation() {
        DungeonMap current = mapWithRoom();
        RoomRegion room = current.rooms().rooms().getFirst();
        RoomCluster cluster = current.topology().roomClusters().getFirst();

        DungeonCommandResult.Rejected missingRoom = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                new RoomNameCommand().plan(current, 999L, "Fehlt"));
        DungeonCommandResult.Rejected unchangedRoom = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                new RoomNarrationCommand().plan(current, room.roomId(), room.narration()));
        DungeonCommandResult.Rejected unchangedCluster = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                new RoomClusterNameCommand().plan(current, cluster.clusterId(), cluster.name()));

        assertEquals(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET, missingRoom.reason());
        assertEquals(DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT, unchangedRoom.reason());
        assertEquals(DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT, unchangedCluster.reason());
        assertEquals(room, current.rooms().findRoom(room.roomId()).orElseThrow());
        assertEquals(cluster, current.topology().roomCluster(cluster.clusterId()));
    }

    private static DungeonMap mapWithRoom() {
        return DungeonCommandTestIdentities.paint(
                DungeonMapAuthoring.empty(new DungeonMapIdentity(93L), "Room Patch Commands"),
                new Cell(1, 1, 0),
                new Cell(2, 2, 0),
                1L,
                1L);
    }
}
