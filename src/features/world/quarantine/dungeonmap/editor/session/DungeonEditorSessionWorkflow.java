package features.world.quarantine.dungeonmap.editor.quarantine.loading;

import features.world.quarantine.dungeonmap.editor.session.edit.DungeonEditorEditCommand;
import features.world.quarantine.dungeonmap.editor.session.edit.DungeonEditorEditLifecycle;
import features.world.quarantine.dungeonmap.editor.session.edit.DungeonEditorReloadLifecycle;
import features.world.quarantine.dungeonmap.editor.DungeonEditorService;
import features.world.quarantine.dungeonmap.foundation.async.DungeonAsyncRunner;
import features.world.quarantine.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayoutEditResult;
import features.world.quarantine.dungeonmap.catalog.model.DungeonMap;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

public final class DungeonEditorSessionWorkflow {

    private final DungeonMapCatalogService mapCatalogService;
    private final DungeonEditorService editorService;
    private final DungeonAsyncRunner asyncRunner;
    private final Object stateLock = new Object();
    private final DungeonEditorReloadLifecycle reloadLifecycle = new DungeonEditorReloadLifecycle(stateLock);
    private final DungeonEditorEditLifecycle editLifecycle;

    public DungeonEditorSessionWorkflow(
            DungeonMapCatalogService mapCatalogService,
            DungeonEditorService editorService,
            DungeonAsyncRunner asyncRunner
    ) {
        this.mapCatalogService = Objects.requireNonNull(mapCatalogService, "mapCatalogService");
        this.editorService = Objects.requireNonNull(editorService, "editorService");
        this.asyncRunner = Objects.requireNonNull(asyncRunner, "asyncRunner");
        this.editLifecycle = new DungeonEditorEditLifecycle(editorService, asyncRunner, reloadLifecycle, stateLock);
    }

    public void refreshMapsAndLayout(
            Long preferredMapId,
            Consumer<DungeonEditorLoadState> onSuccess,
            Consumer<Throwable> onFailure
    ) {
        DungeonAsyncRunner.CancellationHandle handleToCancel;
        long request;
        synchronized (stateLock) {
            handleToCancel = editLifecycle.invalidateSessionForReload();
            request = reloadLifecycle.beginReload();
        }
        handleToCancel.cancel();
        asyncRunner.submit(
                () -> prepareLoad(preferredMapId),
                loadState -> handlePreparedLoad(request, loadState, onSuccess),
                throwable -> deliverLoadFailure(request, throwable, onFailure));
    }

    public void submitEdit(
            long mapId,
            DungeonEditorEditCommand command,
            Consumer<DungeonLayoutEditResult> onSuccess,
            Consumer<Throwable> onFailure
    ) {
        editLifecycle.submitEdit(mapId, command, onSuccess, onFailure);
    }

    public Long sessionMapId() {
        return reloadLifecycle.sessionMapId();
    }

    public Long activeEditSessionId() {
        synchronized (stateLock) {
            return reloadLifecycle.editingEnabled() ? reloadLifecycle.sessionMapId() : null;
        }
    }

    public boolean editingEnabled() {
        return reloadLifecycle.editingEnabled();
    }

    private void handlePreparedLoad(
            long request,
            DungeonEditorLoadState loadState,
            Consumer<DungeonEditorLoadState> onSuccess
    ) {
        if (loadState == null || !reloadLifecycle.isCurrentRequest(request)) {
            return;
        }
        if (!reloadLifecycle.finishReload(request, loadState.selectedMapId())) {
            return;
        }
        onSuccess.accept(loadState);
    }

    private void deliverLoadFailure(
            long request,
            Throwable throwable,
            Consumer<Throwable> onFailure
    ) {
        if (!reloadLifecycle.finishReload(request, null)) {
            return;
        }
        onFailure.accept(throwable);
    }

    private static Long resolveMapSelection(List<DungeonMap> maps, Long preferredMapId) {
        if (preferredMapId != null) {
            for (DungeonMap map : maps) {
                if (preferredMapId.equals(map.mapId())) {
                    return preferredMapId;
                }
            }
        }
        return maps.get(0).mapId();
    }

    private DungeonEditorLoadState prepareLoad(Long preferredMapId) throws Exception {
        List<DungeonMap> maps = mapCatalogService.getAllMaps();
        if (maps.isEmpty()) {
            return DungeonEditorLoadState.empty(maps);
        }
        Long selectedMapId = resolveMapSelection(maps, preferredMapId);
        DungeonLayout layout = editorService.loadLayout(selectedMapId);
        return new DungeonEditorLoadState(
                List.copyOf(maps),
                selectedMapId,
                layout);
    }
}
