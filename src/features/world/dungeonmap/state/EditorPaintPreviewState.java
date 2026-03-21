package features.world.dungeonmap.state;

import features.world.dungeonmap.model.geometry.TileShape;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public final class EditorPaintPreviewState {

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private TileShape previewShape = TileShape.empty();
    private boolean deleteMode;

    public TileShape previewShape() {
        return previewShape;
    }

    public boolean deleteMode() {
        return deleteMode;
    }

    public void addListener(Runnable listener) {
        if (listener != null) {
            listeners.add(listener);
        }
    }

    public void removeListener(Runnable listener) {
        listeners.remove(listener);
    }

    public void showPreview(TileShape previewShape, boolean deleteMode) {
        TileShape nextShape = previewShape == null ? TileShape.empty() : previewShape;
        if (this.previewShape.equals(nextShape) && this.deleteMode == deleteMode) {
            return;
        }
        this.previewShape = nextShape;
        this.deleteMode = deleteMode;
        notifyListeners();
    }

    public void clearPreview() {
        showPreview(TileShape.empty(), false);
    }

    private void notifyListeners() {
        for (Runnable listener : listeners) {
            listener.run();
        }
    }
}
