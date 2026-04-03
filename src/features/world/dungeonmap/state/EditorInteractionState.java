package features.world.dungeonmap.state;

import features.world.dungeonmap.model.interaction.DungeonSelectionRef;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;

public final class EditorInteractionState {

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private DungeonSelectionRef selectedRef;
    private EditorHover hovered;
    private EditorPreview activePreview;

    public DungeonSelectionRef selectedRef() {
        return selectedRef;
    }

    public void selectRef(DungeonSelectionRef ref) {
        if (Objects.equals(selectedRef, ref)) {
            return;
        }
        selectedRef = ref;
        notifyListeners();
    }

    public void clearSelection() {
        selectRef(null);
    }

    public EditorHover hovered() {
        return hovered;
    }

    public void showHover(EditorHover hover) {
        if (Objects.equals(hovered, hover)) {
            return;
        }
        hovered = hover;
        notifyListeners();
    }

    public void clearHover() {
        showHover(null);
    }

    public EditorPreview activePreview() {
        return activePreview;
    }

    public void showPreview(EditorPreview preview) {
        activePreview = preview;
        notifyListeners();
    }

    public void clearPreview() {
        if (activePreview == null) {
            return;
        }
        activePreview = null;
        notifyListeners();
    }

    public void addListener(Runnable listener) {
        if (listener != null) {
            listeners.add(listener);
        }
    }

    private void notifyListeners() {
        for (Runnable listener : listeners) {
            listener.run();
        }
    }
}
