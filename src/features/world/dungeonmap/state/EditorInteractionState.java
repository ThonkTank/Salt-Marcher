package features.world.dungeonmap.state;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;

public final class EditorInteractionState {

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private String selectedTargetKey;
    private EditorPreview activePreview;
    private EditorDraft activeDraft;

    public String selectedTargetKey() {
        return selectedTargetKey;
    }

    public void selectTarget(String targetKey) {
        if (Objects.equals(selectedTargetKey, targetKey)) {
            return;
        }
        selectedTargetKey = targetKey;
        notifyListeners();
    }

    public void clearSelection() {
        selectTarget(null);
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
