package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import src.domain.dungeon.model.core.model.component.CorridorAnchor;
import src.domain.dungeon.model.core.model.component.StairExit;
import src.domain.dungeon.model.core.model.geometry.Cell;
import src.domain.dungeon.model.worldspace.model.DungeonCell;
import src.domain.dungeon.model.worldspace.model.DungeonCorridorAnchorBinding;
import src.domain.dungeon.model.worldspace.model.DungeonStairExit;
import src.domain.dungeon.model.worldspace.model.DungeonTopologyRef;

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
        assertEquals(new DungeonCell(0, 0, 0), defaulted.position(), "adapter null position default");
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
        assertEquals(new DungeonCell(0, 0, 0), defaulted.absoluteCell(), "adapter null anchor cell default");
        assertEquals(DungeonTopologyRef.corridorAnchor(0L), defaulted.topologyRef(), "adapter default topology ref");

        DungeonCorridorAnchorBinding retained = new DungeonCorridorAnchorBinding(
                8L,
                13L,
                new DungeonCell(2, 3, 0),
                DungeonTopologyRef.corridorAnchor(8L));
        assertEquals(8L, retained.anchorId(), "adapter anchor id preservation");
        assertEquals(13L, retained.hostCorridorId(), "adapter host id preservation");

        DungeonCorridorAnchorBinding moved = retained.withAbsoluteCell(new DungeonCell(4, 5, 1));
        assertEquals(8L, moved.anchorId(), "moved adapter anchor id preservation");
        assertEquals(13L, moved.hostCorridorId(), "moved adapter host id preservation");
        assertEquals(
                DungeonTopologyRef.corridorAnchor(8L),
                moved.topologyRef(),
                "moved adapter topology ref preservation");
        assertEquals(new DungeonCell(4, 5, 1), moved.absoluteCell(), "adapter moved anchor cell");
        assertTrue(moved.matches(null, new DungeonCell(4, 5, 1)), "adapter cell match");
        assertFalse(moved.matches(null, new DungeonCell(4, 6, 1)), "adapter cell mismatch");
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

    private static void assertEquals(Object expected, Object actual, String label) {
        if (!expected.equals(actual)) {
            throw new IllegalStateException(label + " expected " + expected + " but was " + actual);
        }
    }
}
