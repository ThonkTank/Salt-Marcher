package src.features.dungeon.runtime;

public enum PointerAction {
    PRESSED,
    DRAGGED,
    RELEASED,
    MOVED;

    public static PointerAction orMoved(PointerAction action) {
        return action == null ? MOVED : action;
    }

    public static boolean isPressed(PointerAction action) {
        return action == PRESSED;
    }

    public static boolean isMoved(PointerAction action) {
        return action == MOVED;
    }

    public boolean pressed() {
        return this == PRESSED;
    }

    public boolean dragged() {
        return this == DRAGGED;
    }

    public boolean released() {
        return this == RELEASED;
    }

    public boolean moved() {
        return this == MOVED;
    }
}
