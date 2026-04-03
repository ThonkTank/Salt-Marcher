package features.world.dungeonmap.state;

import features.world.dungeonmap.application.runtime.DungeonRuntimeNavigationSnapshot;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public final class DungeonRuntimeState {

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private CellCoord persistedCell;
    private int persistedLevelZ;
    private CellCoord previewCell;
    private int previewLevelZ;
    private CardinalDirection heading = CardinalDirection.defaultDirection();
    private boolean loading;
    private boolean dragging;
    private boolean moving;
    private String errorMessage;

    public CellCoord activeCell() {
        return previewCell == null ? persistedCell : previewCell;
    }

    public int activeLevelZ() {
        return previewCell == null ? persistedLevelZ : previewLevelZ;
    }

    public boolean loading() {
        return loading;
    }

    public boolean dragging() {
        return dragging;
    }

    public boolean moving() {
        return moving;
    }

    public CardinalDirection heading() {
        return heading == null ? CardinalDirection.defaultDirection() : heading;
    }

    public String errorMessage() {
        return errorMessage;
    }

    public void addListener(Runnable listener) {
        if (listener != null) {
            listeners.add(listener);
        }
    }

    public void showLoading() {
        loading = true;
        dragging = false;
        moving = false;
        previewCell = null;
        errorMessage = null;
        notifyListeners();
    }

    public void showDragPreview(CellCoord cell, int levelZ) {
        if (cell == null) {
            return;
        }
        previewCell = cell;
        previewLevelZ = levelZ;
        dragging = true;
        moving = false;
        errorMessage = null;
        notifyListeners();
    }

    public void clearDragPreview() {
        previewCell = null;
        dragging = false;
        notifyListeners();
    }

    public void showMoveInProgress() {
        previewCell = null;
        dragging = false;
        moving = true;
        errorMessage = null;
        notifyListeners();
    }

    public void showNavigation(DungeonRuntimeNavigationSnapshot snapshot) {
        persistedCell = snapshot == null ? null : snapshot.cell();
        persistedLevelZ = snapshot == null ? 0 : snapshot.levelZ();
        heading = snapshot == null || snapshot.heading() == null ? CardinalDirection.defaultDirection() : snapshot.heading();
        previewCell = null;
        loading = false;
        dragging = false;
        moving = false;
        errorMessage = null;
        notifyListeners();
    }

    public void showFailure(String errorMessage) {
        loading = false;
        previewCell = null;
        dragging = false;
        moving = false;
        this.errorMessage = errorMessage == null || errorMessage.isBlank()
                ? "Standort konnte nicht geladen werden"
                : errorMessage;
        notifyListeners();
    }

    public void clear() {
        persistedCell = null;
        persistedLevelZ = 0;
        previewCell = null;
        previewLevelZ = 0;
        heading = CardinalDirection.defaultDirection();
        loading = false;
        dragging = false;
        moving = false;
        errorMessage = null;
        notifyListeners();
    }

    private void notifyListeners() {
        for (Runnable listener : listeners) {
            listener.run();
        }
    }
}
