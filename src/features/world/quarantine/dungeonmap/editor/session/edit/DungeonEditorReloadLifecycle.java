package features.world.quarantine.dungeonmap.editor.session.edit;

public final class DungeonEditorReloadLifecycle {

    enum ReloadPhase { IDLE, REQUESTED, LOADING, READY }

    private final Object stateLock;
    private long reloadRequest;
    private ReloadPhase phase = ReloadPhase.IDLE;
    private Long sessionMapId;

    public DungeonEditorReloadLifecycle(Object stateLock) {
        this.stateLock = stateLock;
    }

    public long beginReload() {
        synchronized (stateLock) {
            reloadRequest++;
            transitionTo(ReloadPhase.LOADING);
            sessionMapId = null;
            return reloadRequest;
        }
    }

    public boolean finishReload(long request, Long selectedMapId) {
        synchronized (stateLock) {
            if (reloadRequest != request) {
                return false;
            }
            sessionMapId = selectedMapId;
            transitionTo(selectedMapId != null ? ReloadPhase.READY : ReloadPhase.IDLE);
            return true;
        }
    }

    public boolean isCurrentRequest(long request) {
        synchronized (stateLock) {
            return reloadRequest == request;
        }
    }

    public Long sessionMapId() {
        synchronized (stateLock) {
            return sessionMapId;
        }
    }

    public boolean editingEnabled() {
        synchronized (stateLock) {
            return phase == ReloadPhase.READY;
        }
    }

    // Must be called under stateLock.
    private void transitionTo(ReloadPhase newPhase) {
        boolean valid = switch (newPhase) {
            case IDLE -> phase == ReloadPhase.LOADING;
            case REQUESTED -> phase == ReloadPhase.IDLE || phase == ReloadPhase.READY;
            case LOADING -> phase == ReloadPhase.IDLE || phase == ReloadPhase.READY;
            case READY -> phase == ReloadPhase.LOADING;
        };
        if (!valid) {
            throw new IllegalStateException("Invalid ReloadPhase transition: " + phase + " → " + newPhase);
        }
        phase = newPhase;
    }
}
