package features.world.dungeonmap.state;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;

public final class EditorSelectionState {

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private String selectedTargetKey;

    public String selectedTargetKey() {
        return selectedTargetKey;
    }

    public void addListener(Runnable listener) {
        if (listener != null) {
            listeners.add(listener);
        }
    }

    public void removeListener(Runnable listener) {
        listeners.remove(listener);
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

    private void notifyListeners() {
        for (Runnable listener : listeners) {
            listener.run();
        }
    }
}
