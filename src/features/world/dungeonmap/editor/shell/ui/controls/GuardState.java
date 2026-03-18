package features.world.dungeonmap.editor.shell.ui.controls;

final class GuardState {

    private boolean active;

    void run(Runnable action) {
        active = true;
        try {
            action.run();
        } finally {
            active = false;
        }
    }

    boolean isActive() {
        return active;
    }
}
