package src.view.leftbartabs.dungeoneditor;

import java.util.concurrent.atomic.AtomicBoolean;

final class DungeonEditorControlsGate {

    private final AtomicBoolean enabled = new AtomicBoolean();

    boolean enabled() {
        return enabled.get();
    }

    void runSuppressed(Runnable action) {
        enabled.set(true);
        try {
            action.run();
        } finally {
            enabled.set(false);
        }
    }
}
