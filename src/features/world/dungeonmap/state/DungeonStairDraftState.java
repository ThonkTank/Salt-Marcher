package features.world.dungeonmap.state;

import features.world.dungeonmap.model.structures.stair.StairDirection;
import features.world.dungeonmap.model.structures.stair.StairShape;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;

public final class DungeonStairDraftState {

    private static final String READY_MESSAGE = "Zum Platzieren Feld anklicken";
    private static final String MIN_LEVELS_MESSAGE = "Mindestens zwei verschiedene Ebenen";
    private static final String DUPLICATE_MESSAGE = "Ausgänge dürfen nicht doppelt sein";
    private static final String SIDE_LENGTH_MESSAGE = "Seitenlänge muss größer als 0 sein";
    private static final String DIMENSIONS_MESSAGE = "Breite und Tiefe müssen größer als 0 sein";
    private static final String RADIUS_MESSAGE = "Radius muss größer als 0 sein";

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private int inputLevel;
    private StairShape shape = StairShape.LADDER;
    private StairDirection direction = StairDirection.defaultDirection();
    private int dimension1 = 1;
    private int dimension2 = 1;
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

    public StairShape shape() {
        return shape;
    }

    public StairDirection direction() {
        return direction;
    }

    public int dimension1() {
        return dimension1;
    }

    public int dimension2() {
        return dimension2;
    }

    public String statusMessage() {
        return statusMessage;
    }

    public String displayStatus() {
        return placementError == null || placementError.isBlank() ? statusMessage : placementError;
    }

    public boolean canPlace() {
        return exitLevels.size() >= 2 && validationMessage() == null;
    }

    public void resetForLevel(int level) {
        List<Integer> nextExitLevels = List.of(level);
        String nextStatusMessage = statusFor(shape, dimension1, dimension2, nextExitLevels);
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
            statusMessage = statusFor(shape, dimension1, dimension2, exitLevels);
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
        statusMessage = statusFor(shape, dimension1, dimension2, exitLevels);
        placementError = null;
        notifyListeners();
    }

    public void setShape(StairShape shape) {
        StairShape nextShape = shape == null ? StairShape.LADDER : shape;
        int nextDimension1 = normalizeDimension1(nextShape, dimension1);
        int nextDimension2 = normalizeDimension2(nextShape, dimension2);
        if (this.shape == nextShape
                && dimension1 == nextDimension1
                && dimension2 == nextDimension2
                && !needsStatusRefresh()) {
            return;
        }
        this.shape = nextShape;
        this.dimension1 = nextDimension1;
        this.dimension2 = nextDimension2;
        refreshStatusAndNotify();
    }

    public void setDirection(StairDirection direction) {
        StairDirection nextDirection = direction == null ? StairDirection.defaultDirection() : direction;
        if (this.direction == nextDirection) {
            return;
        }
        this.direction = nextDirection;
        refreshStatusAndNotify();
    }

    public void setDimension1(int dimension1) {
        if (this.dimension1 == dimension1) {
            return;
        }
        this.dimension1 = dimension1;
        refreshStatusAndNotify();
    }

    public void setDimension2(int dimension2) {
        if (this.dimension2 == dimension2) {
            return;
        }
        this.dimension2 = dimension2;
        refreshStatusAndNotify();
    }

    public void removeExitLevel(int level) {
        if (!exitLevels.contains(level)) {
            return;
        }
        ArrayList<Integer> updated = new ArrayList<>(exitLevels);
        updated.remove(Integer.valueOf(level));
        exitLevels = List.copyOf(updated);
        statusMessage = statusFor(shape, dimension1, dimension2, exitLevels);
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
        if (inputLevel == 0
                && shape == StairShape.LADDER
                && direction == StairDirection.defaultDirection()
                && dimension1 == 1
                && dimension2 == 1
                && exitLevels.isEmpty()
                && Objects.equals(statusMessage, MIN_LEVELS_MESSAGE)
                && placementError == null) {
            return;
        }
        inputLevel = 0;
        shape = StairShape.LADDER;
        direction = StairDirection.defaultDirection();
        dimension1 = 1;
        dimension2 = 1;
        exitLevels = List.of();
        statusMessage = MIN_LEVELS_MESSAGE;
        placementError = null;
        notifyListeners();
    }

    private static String statusFor(StairShape shape, int dimension1, int dimension2, List<Integer> levels) {
        if (levels.size() < 2) {
            return MIN_LEVELS_MESSAGE;
        }
        String validationMessage = validationMessage(shape, dimension1, dimension2);
        return validationMessage == null ? READY_MESSAGE : validationMessage;
    }

    private static String validationMessage(StairShape shape, int dimension1, int dimension2) {
        StairShape resolvedShape = shape == null ? StairShape.LADDER : shape;
        if (resolvedShape.needsSideLength() && dimension1 <= 0) {
            return SIDE_LENGTH_MESSAGE;
        }
        if (resolvedShape.needsDimensions() && (dimension1 <= 0 || dimension2 <= 0)) {
            return DIMENSIONS_MESSAGE;
        }
        if (resolvedShape.needsRadius() && dimension1 <= 0) {
            return RADIUS_MESSAGE;
        }
        return null;
    }

    private String validationMessage() {
        return validationMessage(shape, dimension1, dimension2);
    }

    private static int normalizeDimension1(StairShape shape, int currentValue) {
        return shape != null && shape != StairShape.LADDER && currentValue <= 0 ? 1 : currentValue;
    }

    private static int normalizeDimension2(StairShape shape, int currentValue) {
        return shape == StairShape.RECTANGULAR && currentValue <= 0 ? 1 : currentValue;
    }

    private boolean needsStatusRefresh() {
        return !Objects.equals(statusMessage, statusFor(shape, dimension1, dimension2, exitLevels));
    }

    private void refreshStatusAndNotify() {
        String nextStatusMessage = statusFor(shape, dimension1, dimension2, exitLevels);
        if (Objects.equals(statusMessage, nextStatusMessage)) {
            placementError = null;
            notifyListeners();
            return;
        }
        statusMessage = nextStatusMessage;
        placementError = null;
        notifyListeners();
    }

    private void notifyListeners() {
        for (Runnable listener : listeners) {
            listener.run();
        }
    }
}
