package features.world.dungeonmap.editor.session.application.workflow;

final class DungeonEditorReloadLifecycle {

    private final Object stateLock;
    private long reloadRequest;
    private boolean reloadInFlight;
    private Long sessionMapId;

    DungeonEditorReloadLifecycle(Object stateLock) {
        this.stateLock = stateLock;
    }

    long beginReload() {
        synchronized (stateLock) {
            reloadRequest++;
            reloadInFlight = true;
            sessionMapId = null;
            return reloadRequest;
        }
    }

    boolean finishReload(long request, Long selectedMapId) {
        synchronized (stateLock) {
            if (reloadRequest != request) {
                return false;
            }
            sessionMapId = selectedMapId;
            reloadInFlight = false;
            return true;
        }
    }

    boolean isCurrentRequest(long request) {
        synchronized (stateLock) {
            return reloadRequest == request;
        }
    }

    Long sessionMapId() {
        synchronized (stateLock) {
            return sessionMapId;
        }
    }

    boolean editingEnabled() {
        synchronized (stateLock) {
            return !reloadInFlight && sessionMapId != null;
        }
    }
}
