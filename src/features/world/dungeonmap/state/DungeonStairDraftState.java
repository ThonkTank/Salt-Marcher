package features.world.dungeonmap.state;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;

public final class DungeonStairDraftState {

    private static final String READY_MESSAGE = "Zum Platzieren Feld anklicken";
    private static final String MIN_LEVELS_MESSAGE = "Mindestens zwei verschiedene Ebenen";
    private static final String DUPLICATE_MESSAGE = "Ausgänge dürfen nicht doppelt sein";

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private int inputLevel;
    private List<Integer> exitLevels = List.of();
    private String statusMessage = MIN_LEVELS_MESSAGE;
    private String placementError;

    public void addListener(Runnable listener) {
        if (listener != null) {
            listeners.add(listener);
        }
    }

    public void removeListener(Runnable listener) {
        listeners.remove(listener);
    }

    public int inputLevel() {
        return inputLevel;
    }

    public List<Integer> exitLevels() {
        return exitLevels;
    }

    public String statusMessage() {
        return statusMessage;
    }

    public String displayStatus() {
        return placementError == null || placementError.isBlank() ? statusMessage : placementError;
    }

    public boolean canPlace() {
        return exitLevels.size() >= 2;
    }

    public void resetForLevel(int level) {
        List<Integer> nextExitLevels = List.of(level);
        String nextStatusMessage = statusFor(nextExitLevels);
        if (inputLevel == level
                && exitLevels.equals(nextExitLevels)
                && Objects.equals(statusMessage, nextStatusMessage)) {
            return;
        }
        inputLevel = level;
        exitLevels = nextExitLevels;
        statusMessage = nextStatusMessage;
        placementError = null;
        notifyListeners();
    }

    public void setInputLevel(int level) {
        if (inputLevel == level && !Objects.equals(statusMessage, DUPLICATE_MESSAGE)) {
            return;
        }
        inputLevel = level;
        if (Objects.equals(statusMessage, DUPLICATE_MESSAGE)) {
            statusMessage = statusFor(exitLevels);
        }
        placementError = null;
        notifyListeners();
    }

    public void adjustInputLevel(int delta) {
        if (delta != 0) {
            setInputLevel(inputLevel + delta);
        }
    }

    public void addExitLevel() {
        if (exitLevels.contains(inputLevel)) {
            if (!Objects.equals(statusMessage, DUPLICATE_MESSAGE)) {
                statusMessage = DUPLICATE_MESSAGE;
                notifyListeners();
            }
            return;
        }
        ArrayList<Integer> updated = new ArrayList<>(exitLevels);
        updated.add(inputLevel);
        exitLevels = List.copyOf(updated);
        statusMessage = statusFor(exitLevels);
        placementError = null;
        notifyListeners();
    }

    public void removeExitLevel(int level) {
        if (!exitLevels.contains(level)) {
            return;
        }
        ArrayList<Integer> updated = new ArrayList<>(exitLevels);
        updated.remove(Integer.valueOf(level));
        exitLevels = List.copyOf(updated);
        statusMessage = statusFor(exitLevels);
        placementError = null;
        notifyListeners();
    }

    public void showPlacementError(String message) {
        String nextMessage = message == null || message.isBlank() ? null : message.trim();
        if (Objects.equals(placementError, nextMessage)) {
            return;
        }
        placementError = nextMessage;
        notifyListeners();
    }

    public void clearPlacementError() {
        if (placementError == null) {
            return;
        }
        placementError = null;
        notifyListeners();
    }

    public void clear() {
        if (inputLevel == 0 && exitLevels.isEmpty()
                && Objects.equals(statusMessage, MIN_LEVELS_MESSAGE)
                && placementError == null) {
            return;
        }
        inputLevel = 0;
        exitLevels = List.of();
        statusMessage = MIN_LEVELS_MESSAGE;
        placementError = null;
        notifyListeners();
    }

    private static String statusFor(List<Integer> levels) {
        return levels.size() >= 2 ? READY_MESSAGE : MIN_LEVELS_MESSAGE;
    }

    private void notifyListeners() {
        for (Runnable listener : listeners) {
            listener.run();
        }
    }
}
