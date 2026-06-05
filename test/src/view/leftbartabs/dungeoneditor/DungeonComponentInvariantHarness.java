package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import src.domain.dungeon.model.core.component.CorridorAnchor;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.component.CorridorDoorBinding;
import src.domain.dungeon.model.core.component.CorridorWaypoint;
import src.domain.dungeon.model.core.component.StairExit;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.worldspace.DungeonCorridorAnchorBinding;
import src.domain.dungeon.model.worldspace.DungeonCorridorDoorBinding;
import src.domain.dungeon.model.worldspace.DungeonStairExit;

final class DungeonComponentInvariantHarness {

    private static final String OWNER = "DungeonComponentInvariantHarness";

    private DungeonComponentInvariantHarness() {
    }

    static void run(List<String> results) {
        assertStairExitInvariants();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-CMP-001",
                "StairExit keeps local id, position, and label invariants");
        assertCorridorAnchorInvariants();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-CMP-002",
                "CorridorAnchor keeps local id, host corridor id normalization, position, relocation, and position-match invariants");
        assertCorridorBindingComponentInvariants();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-CMP-003",
                "Corridor binding components keep local door, waypoint, and anchor-ref values plus adapter compatibility");
    }

    private static void assertStairExitInvariants() {
        StairExit defaulted = new StairExit(-7L, new Cell(2, 3, 1), " ");
        assertEquals(0L, defaulted.exitId(), "exit id lower bound");
        assertEquals(new Cell(2, 3, 1), defaulted.position(), "exit position");
        assertEquals("Ausgang z=1 (2,3)", defaulted.label(), "default exit label");

        StairExit labelled = new StairExit(9L, new Cell(4, 5, 2), "  Upper Landing  ");
        assertEquals(9L, labelled.exitId(), "positive exit id");
        assertEquals("Upper Landing", labelled.label(), "trimmed exit label");

        assertThrowsNullPosition();
        assertWorldspaceAdapterCompatibility();
    }

    private static void assertThrowsNullPosition() {
        try {
            new StairExit(1L, null, "invalid");
        } catch (NullPointerException expected) {
            return;
        }
        throw new IllegalStateException("StairExit must reject null position");
    }

    private static void assertWorldspaceAdapterCompatibility() {
        DungeonStairExit defaulted = new DungeonStairExit(-2L, null, "");
        assertEquals(0L, defaulted.exitId(), "adapter exit id lower bound");
        assertEquals(new Cell(0, 0, 0), defaulted.position(), "adapter null position default");
        assertEquals("Ausgang z=0 (0,0)", defaulted.label(), "adapter default label");
    }

    private static void assertCorridorAnchorInvariants() {
        CorridorAnchor anchor = new CorridorAnchor(-3L, -5L, new Cell(7, 8, 2));
        assertEquals(0L, anchor.anchorId(), "anchor id lower bound");
        assertEquals(0L, anchor.hostCorridorId(), "anchor host corridor id lower bound");
        assertEquals(new Cell(7, 8, 2), anchor.position(), "anchor position");
        assertTrue(anchor.matchesPosition(new Cell(7, 8, 2)), "anchor position match");
        assertFalse(anchor.matchesPosition(new Cell(7, 9, 2)), "anchor position mismatch");

        CorridorAnchor retained = new CorridorAnchor(3L, 5L, new Cell(1, 2, 0));
        assertEquals(3L, retained.anchorId(), "anchor id preservation");
        assertEquals(5L, retained.hostCorridorId(), "anchor host corridor id preservation");

        CorridorAnchor moved = retained.withPosition(new Cell(9, 10, 3));
        assertEquals(3L, moved.anchorId(), "moved anchor id preservation");
        assertEquals(5L, moved.hostCorridorId(), "moved anchor host corridor id preservation");
        assertEquals(new Cell(9, 10, 3), moved.position(), "moved anchor position");

        assertThrowsNullAnchorPosition();
        assertWorldspaceAnchorAdapterCompatibility();
    }

    private static void assertThrowsNullAnchorPosition() {
        try {
            new CorridorAnchor(1L, 2L, null);
        } catch (NullPointerException expected) {
            return;
        }
        throw new IllegalStateException("CorridorAnchor must reject null position");
    }

    private static void assertWorldspaceAnchorAdapterCompatibility() {
        DungeonCorridorAnchorBinding defaulted = new DungeonCorridorAnchorBinding(-4L, -6L, null, null);
        assertEquals(0L, defaulted.anchorId(), "adapter anchor id lower bound");
        assertEquals(0L, defaulted.hostCorridorId(), "adapter host id lower bound");
        assertEquals(new Cell(0, 0, 0), defaulted.absoluteCell(), "adapter null anchor cell default");
        assertEquals(DungeonTopologyRef.corridorAnchor(0L), defaulted.topologyRef(), "adapter default topology ref");

        DungeonCorridorAnchorBinding retained = new DungeonCorridorAnchorBinding(
                8L,
                13L,
                new Cell(2, 3, 0),
                DungeonTopologyRef.corridorAnchor(8L));
        assertEquals(8L, retained.anchorId(), "adapter anchor id preservation");
        assertEquals(13L, retained.hostCorridorId(), "adapter host id preservation");

        DungeonCorridorAnchorBinding moved = retained.withAbsoluteCell(new Cell(4, 5, 1));
        assertEquals(8L, moved.anchorId(), "moved adapter anchor id preservation");
        assertEquals(13L, moved.hostCorridorId(), "moved adapter host id preservation");
        assertEquals(
                DungeonTopologyRef.corridorAnchor(8L),
                moved.topologyRef(),
                "moved adapter topology ref preservation");
        assertEquals(new Cell(4, 5, 1), moved.absoluteCell(), "adapter moved anchor cell");
        assertTrue(moved.toCore().matchesPosition(new Cell(4, 5, 1)), "adapter cell match");
        assertFalse(moved.toCore().matchesPosition(new Cell(4, 6, 1)), "adapter cell mismatch");
    }

    private static void assertCorridorBindingComponentInvariants() {
        CorridorDoorBinding door = new CorridorDoorBinding(-1L, -2L, new Cell(3, 4, 1), Direction.EAST);
        assertEquals(0L, door.roomId(), "door binding room lower bound");
        assertEquals(0L, door.clusterId(), "door binding cluster lower bound");

        CorridorDoorBinding retainedDoor = new CorridorDoorBinding(7L, 11L, new Cell(1, 2, 0), Direction.SOUTH);
        assertEquals(7L, retainedDoor.roomId(), "door binding room id preservation");
        assertEquals(11L, retainedDoor.clusterId(), "door binding cluster id preservation");
        assertEquals(new Cell(1, 2, 0), retainedDoor.relativeCell(), "door binding relative cell");
        assertEquals(Direction.SOUTH, retainedDoor.direction(), "door binding direction");

        CorridorWaypoint waypoint = new CorridorWaypoint(-3L, new Cell(2, 3, 4), 4);
        assertEquals(0L, waypoint.clusterId(), "waypoint cluster lower bound");
        assertEquals(new Cell(7, 9, 4), waypoint.absoluteCell(new Cell(5, 6, 4)), "waypoint absolute cell");

        CorridorAnchorRef missingRef = new CorridorAnchorRef(-4L, -5L);
        assertEquals(0L, missingRef.hostCorridorId(), "anchor ref host lower bound");
        assertEquals(0L, missingRef.anchorId(), "anchor ref id lower bound");
        assertFalse(missingRef.present(), "missing anchor ref absent");

        CorridorAnchorRef presentRef = new CorridorAnchorRef(9L, 10L);
        assertEquals(9L, presentRef.hostCorridorId(), "anchor ref host id preservation");
        assertEquals(10L, presentRef.anchorId(), "anchor ref id preservation");
        assertTrue(presentRef.present(), "anchor ref present");

        assertThrowsNullCorridorBindingComponentValues();
        assertWorldspaceCorridorBindingAdapterCompatibility();
    }

    private static void assertThrowsNullCorridorBindingComponentValues() {
        assertThrowsNull(
                () -> new CorridorDoorBinding(1L, 2L, null, Direction.NORTH),
                "corridor door binding null cell");
        assertThrowsNull(
                () -> new CorridorDoorBinding(1L, 2L, new Cell(0, 0, 0), null),
                "corridor door binding null direction");
        assertThrowsNull(
                () -> new CorridorWaypoint(1L, null, 0),
                "corridor waypoint null relative cell");
    }

    private static void assertWorldspaceCorridorBindingAdapterCompatibility() {
        DungeonCorridorDoorBinding defaultedDoor = new DungeonCorridorDoorBinding(-1L, -2L, null, null, null);
        assertEquals(0L, defaultedDoor.roomId(), "adapter door room lower bound");
        assertEquals(0L, defaultedDoor.clusterId(), "adapter door cluster lower bound");
        assertEquals(new Cell(0, 0, 0), defaultedDoor.relativeCell(), "adapter door null cell default");
        assertEquals(Direction.NORTH, defaultedDoor.direction(), "adapter door null direction default");
        assertEquals(DungeonTopologyRef.empty(), defaultedDoor.topologyRef(), "adapter door null topology ref");

        DungeonCorridorDoorBinding retainedDoor = new DungeonCorridorDoorBinding(
                12L,
                14L,
                new Cell(2, 3, 1),
                Direction.WEST,
                DungeonTopologyRef.door(21L));
        assertEquals(12L, retainedDoor.roomId(), "adapter door room id preservation");
        assertEquals(14L, retainedDoor.clusterId(), "adapter door cluster id preservation");
        assertEquals(new Cell(2, 3, 1), retainedDoor.relativeCell(), "adapter door relative cell");
        assertEquals(Direction.WEST, retainedDoor.direction(), "adapter door direction");
        assertTrue(retainedDoor.topologyRef().present(), "adapter door topology ref present");

        CorridorWaypoint defaultedWaypoint = corridorWaypoint(-9L, null, 2);
        assertEquals(0L, defaultedWaypoint.clusterId(), "adapter waypoint cluster lower bound");
        assertEquals(new Cell(0, 0, 2), defaultedWaypoint.relativeCell(), "adapter waypoint null default");
        assertEquals(new Cell(4, 5, 2), defaultedWaypoint.absoluteCell(new Cell(4, 5, 2)),
                "adapter waypoint absolute default");
        CorridorWaypoint retainedWaypoint = corridorWaypoint(17L, new Cell(1, -2, 3), 3);
        assertEquals(17L, retainedWaypoint.clusterId(), "adapter waypoint cluster preservation");
        assertEquals(new Cell(8, 5, 3), retainedWaypoint.absoluteCell(new Cell(7, 7, 3)),
                "adapter waypoint absolute retained");
    }

    private static CorridorWaypoint corridorWaypoint(long clusterId, Cell relativeCell, int level) {
        Cell cell = relativeCell == null
                ? new Cell(0, 0, level)
                : relativeCell;
        return new CorridorWaypoint(clusterId, cell, level);
    }

    private static void assertTrue(boolean condition, String label) {
        if (!condition) {
            throw new IllegalStateException(label + " expected true");
        }
    }

    private static void assertFalse(boolean condition, String label) {
        if (condition) {
            throw new IllegalStateException(label + " expected false");
        }
    }

    private static void assertThrowsNull(Runnable action, String label) {
        try {
            action.run();
        } catch (NullPointerException expected) {
            return;
        }
        throw new IllegalStateException(label + " expected NullPointerException");
    }

    private static void assertEquals(Object expected, Object actual, String label) {
        if (!expected.equals(actual)) {
            throw new IllegalStateException(label + " expected " + expected + " but was " + actual);
        }
    }
}
