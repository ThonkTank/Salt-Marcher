package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonLayoutEditResult;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.service.catalog.DungeonMapCatalogService;
import features.world.dungeonmap.service.editor.DungeonEditorService;
import features.world.dungeonmap.ui.workspace.render.DungeonWorkspaceRenderState;
import ui.async.UiAsyncTasks;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

final class DungeonEditorApplicationService {

    private final DungeonMapCatalogService mapCatalogService;
    private final DungeonEditorService editorService;
    private final AtomicLong loadSequence = new AtomicLong();
    private final AtomicLong editSequence = new AtomicLong();

    private Long activeMapId;

    DungeonEditorApplicationService(
            DungeonMapCatalogService mapCatalogService,
            DungeonEditorService editorService
    ) {
        this.mapCatalogService = Objects.requireNonNull(mapCatalogService, "mapCatalogService");
        this.editorService = Objects.requireNonNull(editorService, "editorService");
    }

    void refreshMapsAndLayout(
            Long preferredMapId,
            Consumer<DungeonEditorLoadState> onSuccess,
            Consumer<Throwable> onFailure
    ) {
        editSequence.incrementAndGet();
        long request = loadSequence.incrementAndGet();
        UiAsyncTasks.submit(
                mapCatalogService::getAllMaps,
                maps -> handleMapsLoaded(request, maps, preferredMapId, onSuccess, onFailure),
                throwable -> deliverLoadFailure(request, throwable, onFailure));
    }

    void submitEdit(
            long mapId,
            Callable<DungeonLayoutEditResult> work,
            BiConsumer<DungeonLayoutEditResult, DungeonWorkspaceRenderState> onSuccess,
            Consumer<Throwable> onFailure
    ) {
        activeMapId = mapId;
        long request = editSequence.incrementAndGet();
        UiAsyncTasks.submit(() -> {
                    DungeonLayoutEditResult result = work.call();
                    return result == null ? null : new PreparedEdit(result, DungeonWorkspaceRenderState.from(result.layout()));
                },
                prepared -> {
                    if (isCurrentEdit(mapId, request)) {
                        onSuccess.accept(prepared == null ? null : prepared.result(), prepared == null ? null : prepared.renderState());
                    }
                },
                throwable -> {
                    if (isCurrentEdit(mapId, request)) {
                        onFailure.accept(throwable);
                    }
                });
    }

    Long activeMapId() {
        return activeMapId;
    }

    private void handleMapsLoaded(
            long request,
            List<DungeonMap> maps,
            Long preferredMapId,
            Consumer<DungeonEditorLoadState> onSuccess,
            Consumer<Throwable> onFailure
    ) {
        if (request != loadSequence.get()) {
            return;
        }
        if (maps.isEmpty()) {
            activeMapId = null;
            onSuccess.accept(DungeonEditorLoadState.empty(maps));
            return;
        }
        Long selectedMapId = resolveMapSelection(maps, preferredMapId);
        activeMapId = selectedMapId;
        UiAsyncTasks.submit(
                () -> DungeonWorkspaceRenderState.from(editorService.loadLayout(selectedMapId)),
                renderState -> {
                    if (request != loadSequence.get()) {
                        return;
                    }
                    activeMapId = selectedMapId;
                    onSuccess.accept(new DungeonEditorLoadState(List.copyOf(maps), selectedMapId, renderState));
                },
                throwable -> deliverLoadFailure(request, throwable, onFailure));
    }

    private void deliverLoadFailure(
            long request,
            Throwable throwable,
            Consumer<Throwable> onFailure
    ) {
        if (request == loadSequence.get()) {
            onFailure.accept(throwable);
        }
    }

    private boolean isCurrentEdit(long mapId, long request) {
        return activeMapId != null && activeMapId == mapId && editSequence.get() == request;
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

    private record PreparedEdit(
            DungeonLayoutEditResult result,
            DungeonWorkspaceRenderState renderState
    ) {
    }
}
