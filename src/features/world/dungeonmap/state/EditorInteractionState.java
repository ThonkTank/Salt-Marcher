package features.world.dungeonmap.state;

import features.world.dungeonmap.shell.interaction.DungeonSelectionKey;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;

public final class EditorInteractionState {

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private DungeonSelectionKey selectedKey;
    private EditorHover hovered;
    private EditorPreview activePreview;
    private EditorDraft activeDraft;

    public DungeonSelectionKey selectedKey() {
        return selectedKey;
    }

    public void selectKey(DungeonSelectionKey key) {
        if (Objects.equals(selectedKey, key)) {
            return;
        }
        selectedKey = key;
        notifyListeners();
    }

    public void clearSelection() {
        selectKey(null);
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

    public EditorDraft activeDraft() {
        return activeDraft;
    }

    public void showDraft(EditorDraft draft) {
        activeDraft = draft;
        notifyListeners();
    }

    public void clearDraft() {
        if (activeDraft == null) {
            return;
        }
        activeDraft = null;
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
