package features.dungeon.application.editor;

import org.jspecify.annotations.Nullable;
import features.dungeon.api.DungeonEditorHandleKind;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.PointerState;

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
                && (ref.kind() == DungeonEditorHandleKind.CORRIDOR_ANCHOR
                        || ref.kind() == DungeonEditorHandleKind.CORRIDOR_WAYPOINT);
    }

    private static boolean sameCell(
            PointerState input,
            features.dungeon.domain.core.geometry.Cell cell
    ) {
        return input.q() == cell.q()
                && input.r() == cell.r()
                && input.level() == cell.level();
    }
}
