package src.features.dungeon.runtime;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleType;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PointerState;

final class DungeonEditorCorridorPointLookup {

    private DungeonEditorCorridorPointLookup() {
    }

    static DungeonEditorWorkspaceValues.HandleRef authoredPointAt(
            @Nullable PointerState input,
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
            long corridorId
    ) {
        if (input == null || snapshot == null || !DungeonEditorWorkspaceValues.hasId(corridorId)) {
            return DungeonEditorSessionValues.emptyHandleRef();
        }
        for (DungeonEditorWorkspaceValues.Handle handle : snapshot.editorHandles()) {
            DungeonEditorWorkspaceValues.HandleRef ref = handle.ref();
            if (editableCorridorPoint(ref, corridorId) && sameCell(input, ref.cell())) {
                return ref;
            }
        }
        return DungeonEditorSessionValues.emptyHandleRef();
    }

    private static boolean editableCorridorPoint(
            DungeonEditorWorkspaceValues.HandleRef ref,
            long corridorId
    ) {
        return ref != null
                && ref.corridorId() == corridorId
                && (ref.kind() == DungeonEditorHandleType.CORRIDOR_ANCHOR
                        || ref.kind() == DungeonEditorHandleType.CORRIDOR_WAYPOINT);
    }

    private static boolean sameCell(
            PointerState input,
            DungeonEditorWorkspaceValues.Cell cell
    ) {
        return input.q() == cell.q()
                && input.r() == cell.r()
                && input.level() == cell.level();
    }
}
