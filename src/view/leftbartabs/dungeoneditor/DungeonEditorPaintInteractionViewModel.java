package src.view.leftbartabs.dungeoneditor;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.view.leftbartabs.dungeoneditor.DungeonEditorViewModel.PointerInput;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel.PaintPreview;

final class DungeonEditorPaintInteractionViewModel {

    static final String ROOM_PAINT_TOOL = "Raum malen";
    static final String ROOM_DELETE_TOOL = "Raum loeschen";

    private final ReadOnlyObjectWrapper<PaintPreview> paintPreview = new ReadOnlyObjectWrapper<>();
    private @Nullable PaintSession paintSession;

    ReadOnlyObjectProperty<PaintPreview> paintPreviewProperty() {
        return paintPreview.getReadOnlyProperty();
    }

    boolean press(PointerInput input, String selectedTool) {
        if (input == null || !roomPaintToolSelected(selectedTool)) {
            return false;
        }
        paintSession = new PaintSession(
                input.q(),
                input.r(),
                input.q(),
                input.r(),
                input.level(),
                ROOM_DELETE_TOOL.equals(selectedTool));
        paintPreview.set(toPreview(paintSession));
        return true;
    }

    boolean drag(PointerInput input, String selectedTool) {
        if (paintSession == null || input == null || !input.primaryButtonDown() || !roomPaintToolSelected(selectedTool)) {
            return false;
        }
        paintSession = paintSession.withEnd(input.q(), input.r());
        paintPreview.set(toPreview(paintSession));
        return true;
    }

    @Nullable PaintCommit release(@Nullable PointerInput input, String selectedTool) {
        PaintSession session = paintSession;
        if (session == null) {
            return null;
        }
        paintSession = null;
        paintPreview.set(null);
        if (!roomPaintToolSelected(selectedTool)) {
            return null;
        }
        PaintSession released = input == null ? session : session.withEnd(input.q(), input.r());
        DungeonCellRef start = new DungeonCellRef(released.startQ(), released.startR(), released.level());
        DungeonCellRef end = new DungeonCellRef(released.endQ(), released.endR(), released.level());
        DungeonEditorOperation operation = released.deleteMode()
                ? new DungeonEditorOperation.DeleteRoomRectangle(start, end)
                : new DungeonEditorOperation.PaintRoomRectangle(start, end);
        String status = released.deleteMode() ? "Raumflaeche geloescht." : "Raumflaeche gemalt.";
        return new PaintCommit(operation, status);
    }

    void clear() {
        paintSession = null;
        paintPreview.set(null);
    }

    String stateText() {
        PaintPreview currentPaintPreview = paintPreview.get();
        if (currentPaintPreview == null || !currentPaintPreview.active()) {
            return "Raumvorschau: inaktiv";
        }
        return "Raumvorschau: "
                + (currentPaintPreview.deleteMode() ? "loeschen" : "malen")
                + " z=" + currentPaintPreview.level();
    }

    boolean roomPaintToolSelected(String selectedTool) {
        return ROOM_PAINT_TOOL.equals(selectedTool) || ROOM_DELETE_TOOL.equals(selectedTool);
    }

    private static PaintPreview toPreview(PaintSession session) {
        return new PaintPreview(
                session.startQ(),
                session.startR(),
                session.endQ(),
                session.endR(),
                session.level(),
                session.deleteMode());
    }

    record PaintCommit(DungeonEditorOperation operation, String status) {
    }

    private record PaintSession(
            int startQ,
            int startR,
            int endQ,
            int endR,
            int level,
            boolean deleteMode
    ) {

        PaintSession withEnd(int nextEndQ, int nextEndR) {
            return new PaintSession(startQ, startR, nextEndQ, nextEndR, level, deleteMode);
        }
    }
}
