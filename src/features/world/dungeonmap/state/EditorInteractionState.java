package features.world.dungeonmap.state;

import features.world.dungeonmap.shell.interaction.DungeonHitSubject;
import features.world.dungeonmap.shell.interaction.DungeonSelection;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;

public final class EditorInteractionState {

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private DungeonHitSubject selectedSubject;
    private EditorPreview activePreview;
    private EditorDraft activeDraft;

    public DungeonHitSubject selectedSubject() {
        return selectedSubject;
    }

    public String selectedTargetKey() {
        if (selectedSubject == null) {
            return null;
        }
        return selectedSubject.targetKey();
    }

    public void applySelection(DungeonSelection selection) {
        selectSubject(primarySubject(selection));
    }

    public void selectSubject(DungeonHitSubject subject) {
        if (Objects.equals(selectedSubject, subject)) {
            return;
        }
        selectedSubject = subject;
        notifyListeners();
    }

    public void clearSelection() {
        selectSubject(null);
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

    private static DungeonHitSubject primarySubject(DungeonSelection selection) {
        return selection == null || selection.primary() == null
                ? null
                : selection.primary().descriptor().subject();
    }
}
