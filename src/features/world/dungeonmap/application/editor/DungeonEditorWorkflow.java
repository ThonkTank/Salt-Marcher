package features.world.dungeonmap.application.editor;

import features.world.dungeonmap.domain.model.DungeonLayoutEditResult;
import features.world.dungeonmap.domain.model.DungeonLayout;
import features.world.dungeonmap.domain.model.DungeonMap;
import features.world.dungeonmap.application.catalog.DungeonMapCatalogService;
import ui.async.UiAsyncTasks;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

public final class DungeonEditorWorkflow {

    private final DungeonMapCatalogService mapCatalogService;
    private final DungeonEditorService editorService;
    private final AtomicLong loadSequence = new AtomicLong();
    private final AtomicLong editSequence = new AtomicLong();

    private Long activeMapId;

    public DungeonEditorWorkflow(
            DungeonMapCatalogService mapCatalogService,
            DungeonEditorService editorService
    ) {
        this.mapCatalogService = Objects.requireNonNull(mapCatalogService, "mapCatalogService");
        this.editorService = Objects.requireNonNull(editorService, "editorService");
    }

    public void refreshMapsAndLayout(
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

    public void submitEdit(
            long mapId,
            Callable<DungeonLayoutEditResult> work,
            BiConsumer<DungeonLayoutEditResult, DungeonLayout> onSuccess,
            Consumer<Throwable> onFailure
    ) {
        activeMapId = mapId;
        long request = editSequence.incrementAndGet();
        UiAsyncTasks.submit(() -> {
                    DungeonLayoutEditResult result = work.call();
                    return result == null ? null : new PreparedEdit(result, result.layout());
                },
                prepared -> {
                    if (isCurrentEdit(mapId, request)) {
                        onSuccess.accept(prepared == null ? null : prepared.result(), prepared == null ? null : prepared.layout());
                    }
                },
                throwable -> {
                    if (isCurrentEdit(mapId, request)) {
                        onFailure.accept(throwable);
                    }
                });
    }

    public Long activeMapId() {
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
                () -> editorService.loadLayout(selectedMapId),
                layout -> {
                    if (request != loadSequence.get()) {
                        return;
                    }
                    activeMapId = selectedMapId;
                    onSuccess.accept(new DungeonEditorLoadState(List.copyOf(maps), selectedMapId, layout));
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
            DungeonLayout layout
    ) {
    }
}
