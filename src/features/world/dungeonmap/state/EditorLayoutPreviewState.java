package features.world.dungeonmap.state;

import features.world.dungeonmap.model.DungeonLayout;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public final class EditorLayoutPreviewState {

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private DungeonLayout previewMap;

    public DungeonLayout previewMap() {
        return previewMap;
    }

    public void addListener(Runnable listener) {
        if (listener != null) {
            listeners.add(listener);
        }
    }

    public void removeListener(Runnable listener) {
        listeners.remove(listener);
    }

    public void showPreview(DungeonLayout previewMap) {
        if (this.previewMap == previewMap) {
            return;
        }
        this.previewMap = previewMap;
        notifyListeners();
    }

    public void clearPreview() {
        showPreview(null);
    }

    private void notifyListeners() {
        for (Runnable listener : listeners) {
            listener.run();
        }
    }
}
