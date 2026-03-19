package features.world.quarantine.dungeonmap.editor.shell.controls;

public final class GuardState {

    private boolean active;

    public void run(Runnable action) {
        active = true;
        try {
            action.run();
        } finally {
            active = false;
        }
    }

    public boolean isActive() {
        return active;
    }
}
