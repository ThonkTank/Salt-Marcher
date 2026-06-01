package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import src.domain.dungeon.model.core.model.component.StairExit;
import src.domain.dungeon.model.core.model.geometry.Cell;
import src.domain.dungeon.model.worldspace.model.DungeonCell;
import src.domain.dungeon.model.worldspace.model.DungeonStairExit;

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

    private static void assertEquals(Object expected, Object actual, String label) {
        if (!expected.equals(actual)) {
            throw new IllegalStateException(label + " expected " + expected + " but was " + actual);
        }
    }
}
