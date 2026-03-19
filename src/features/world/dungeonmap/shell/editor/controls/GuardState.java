package features.world.dungeonmap.shell.editor.controls;

final class GuardState {

    private boolean active;

    boolean isActive() {
        return active;
    }

    void run(Runnable action) {
        active = true;
        try {
            action.run();
        } finally {
            active = false;
        }
    }
}
