package features.world.dungeonmap.state;

import features.world.dungeonmap.shell.interaction.DungeonSelection;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;

public final class EditorInteractionState {

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private DungeonSelection selectedSelection;
    private EditorPreview activePreview;
    private EditorDraft activeDraft;

    public DungeonSelection selectedSelection() {
        return selectedSelection;
    }

    public String selectedTargetKey() {
        if (selectedSelection == null || selectedSelection.primary() == null) {
            return null;
        }
        return selectedSelection.primary().descriptor().subject().targetKey();
    }

    public String selectedPartKey() {
        if (selectedSelection == null || selectedSelection.primary() == null) {
            return null;
        }
        return selectedSelection.primary().descriptor().subject().partKey();
    }

    public void applySelection(DungeonSelection selection) {
        if (Objects.equals(selectedSelection, selection)) {
            return;
        }
        selectedSelection = selection;
        notifyListeners();
    }

    public void clearSelection() {
        applySelection(null);
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
