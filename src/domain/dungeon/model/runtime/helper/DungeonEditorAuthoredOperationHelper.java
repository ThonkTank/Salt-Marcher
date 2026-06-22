package src.domain.dungeon.model.runtime.helper;

import java.util.List;
import java.util.ArrayList;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.structure.room.DungeonRoomExitDescription;
import src.domain.dungeon.model.core.structure.room.DungeonRoomNarration;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleType;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorRoomNarrationInput;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceCoreGeometry;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceHandleMovement;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorAuthoredOperation;

public interface DungeonEditorAuthoredOperationHelper {

    static DungeonRoomNarration roomNarration(DungeonEditorRoomNarrationInput roomNarration) {
        return new DungeonRoomNarration(
                roomNarration.visualDescription(),
                roomExits(roomNarration.exits()));
    }

    static @Nullable DungeonEditorAuthoredOperation authoredOperation(
            DungeonEditorSessionValues.Preview preview
    ) {
        return switch (preview) {
            case null -> null;
            case DungeonEditorSessionValues.NoPreview ignored -> null;
            case DungeonEditorSessionValues.RoomRectanglePreview ignored -> null;
            case DungeonEditorSessionValues.ClusterBoundariesPreview ignored -> null;
            case DungeonEditorSessionValues.StairCreatePreview ignored -> null;
            case DungeonEditorSessionValues.CorridorCreatePreview ignored -> null;
            case DungeonEditorSessionValues.DeleteCorridorPreview ignored -> null;
            case DungeonEditorSessionValues.MoveHandlePreview moveHandle -> moveEditorHandleOperation(moveHandle);
            case DungeonEditorSessionValues.MoveBoundaryStretchPreview ignored -> null;
        };
    }

    static Cell cell(DungeonEditorWorkspaceValues.Cell cell) {
        DungeonEditorWorkspaceValues.Cell safeCell = cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : cell;
        return DungeonEditorWorkspaceCoreGeometry.cell(safeCell);
    }

    private static List<DungeonRoomExitDescription> roomExits(
            List<DungeonEditorWorkspaceValues.RoomExitNarration> exits
    ) {
        List<DungeonRoomExitDescription> result = new ArrayList<>();
        for (DungeonEditorWorkspaceValues.RoomExitNarration exit : exits) {
            DungeonEditorWorkspaceValues.RoomExitNarration safeExit = exit == null
                    ? new DungeonEditorWorkspaceValues.RoomExitNarration(
                            "",
                            DungeonEditorWorkspaceValues.Cell.empty(),
                            "",
                            "")
                    : exit;
            result.add(new DungeonRoomExitDescription(
                    cell(safeExit.cell()),
                    Direction.parse(safeExit.direction()),
                    safeExit.description()));
        }
        return List.copyOf(result);
    }

    private static @Nullable DungeonEditorAuthoredOperation moveEditorHandleOperation(
            DungeonEditorSessionValues.MoveHandlePreview moveHandle
    ) {
        if (directRuntimeCommittedHandle(moveHandle.handleRef().kind())) {
            return null;
        }
        return DungeonEditorAuthoredOperation.moveEditorHandle(
                DungeonEditorWorkspaceHandleMovement.from(moveHandle.handleRef()),
                moveHandle.deltaQ(),
                moveHandle.deltaR(),
                moveHandle.deltaLevel());
    }

    private static boolean directRuntimeCommittedHandle(DungeonEditorHandleType kind) {
        return kind == DungeonEditorHandleType.CLUSTER_LABEL
                || kind == DungeonEditorHandleType.CLUSTER_CORNER
                || kind == DungeonEditorHandleType.CLUSTER_WALL_RUN;
    }
}
