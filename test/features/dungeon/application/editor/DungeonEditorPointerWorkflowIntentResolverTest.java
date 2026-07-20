package features.dungeon.application.editor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.api.editor.DungeonEditorPointerGesture;
import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.api.editor.DungeonEditorToolOptions;
import features.dungeon.api.editor.DungeonEditorToolSelection;
import org.junit.jupiter.api.Test;

final class DungeonEditorPointerWorkflowIntentResolverTest {

    @Test
    void derivesCreateAndDeleteFromOneSelectedFamilyAndThePointerGesture() {
        DungeonEditorToolSelection room = DungeonEditorToolSelection.family(DungeonEditorToolFamily.ROOM);

        PointerWorkflowIntent create = DungeonEditorPointerWorkflowIntentResolver.resolve(
                room,
                new DungeonEditorPointerGesture(DungeonEditorPointerGesture.Button.PRIMARY, false, false));
        PointerWorkflowIntent delete = DungeonEditorPointerWorkflowIntentResolver.resolve(
                room,
                new DungeonEditorPointerGesture(DungeonEditorPointerGesture.Button.SECONDARY, false, false));

        assertTrue(create.toolAction().is(DungeonEditorToolFamily.ROOM, DungeonEditorToolAction.Operation.CREATE));
        assertTrue(delete.toolAction().is(DungeonEditorToolFamily.ROOM, DungeonEditorToolAction.Operation.DELETE));
    }

    @Test
    void ignoresShiftSecondaryOutsideTheWallAlternateGesture() {
        DungeonEditorPointerGesture alternate = new DungeonEditorPointerGesture(
                DungeonEditorPointerGesture.Button.SECONDARY,
                true,
                false);

        assertFalse(DungeonEditorPointerWorkflowIntentResolver.resolve(
                DungeonEditorToolSelection.family(DungeonEditorToolFamily.ROOM), alternate).workflowAccepted());
        assertTrue(DungeonEditorPointerWorkflowIntentResolver.resolve(
                DungeonEditorToolSelection.family(DungeonEditorToolFamily.WALL), alternate).workflowAccepted());
    }

    @Test
    void keepsTypedWallOptionsWhileResolvingTheEffectiveAction() {
        DungeonEditorToolSelection singleWall = DungeonEditorToolSelection.wall(
                DungeonEditorToolOptions.Wall.Mode.SINGLE);

        PointerWorkflowIntent intent = DungeonEditorPointerWorkflowIntentResolver.resolve(
                singleWall,
                new DungeonEditorPointerGesture(DungeonEditorPointerGesture.Button.PRIMARY, false, false));

        assertEquals(singleWall, intent.toolAction().selection());
        assertTrue(intent.wallSingleClickMode());
    }
}
