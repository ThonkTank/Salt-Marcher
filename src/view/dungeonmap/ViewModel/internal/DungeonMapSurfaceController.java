package src.view.dungeonshared.assembly;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.DungeonEditorOperation;
import src.domain.dungeon.api.DungeonInspectorSnapshot;
import src.domain.dungeon.api.DungeonOperationResult;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.dungeon.api.DungeonMapSummary;
import src.domain.dungeon.api.Viewport;
import src.domain.dungeon.DungeonApplicationService;
import src.view.dungeonshared.ViewModel.DungeonLoadedMapViewModel;
import src.view.dungeonshared.ViewModel.DungeonMapSurfaceViewModel;
import src.view.dungeonshared.ViewModel.DungeonMapSurfaceViewState;
import src.view.dungeonshared.ViewModel.DungeonMapSummaryViewModel;
import src.view.dungeonshared.ViewModel.DungeonOverlayMode;
import src.view.dungeonshared.ViewModel.DungeonOverlaySettings;
import src.view.dungeonshared.ViewModel.DungeonSelectionItemViewModel;
import src.view.dungeonshared.ViewModel.DungeonViewportViewModel;
import java.util.List;
/**
 * Shared controller for dungeon map selection, loading, creation, deletion, and placeholder edit hooks.
 */
// PMD suppression is local: this shared controller is the single facade for map-surface actions and state; see src/view/dungeoneditor/UI.md.
@SuppressWarnings("PMD.TooManyMethods")
public final class DungeonMapSurfaceController extends AbstractDungeonMapCatalogController
        implements DungeonMapSurfaceViewModel {
    private static final DungeonMapSurfaceController SHARED = new DungeonMapSurfaceController(new DungeonApplicationService());
    private DungeonMapSurfaceController(DungeonApplicationService dungeon) {
        super(dungeon);
    }
    static DungeonMapSurfaceController shared() {
        return SHARED;
    }
    @Override
    public void addListener(Runnable listener) {
        super.addListener(listener);
    }
    @Override
    public void setSearchText(String value) {
        super.setSearchText(value);
    }
    @Override
    public void deleteLoaded() {
        super.deleteLoaded();
    }
    @Override
    public String defaultMapName() {
        return super.defaultMapName();
    }
    public DungeonInspectorSnapshot describeSelection(String ownerKind, long ownerId) {
        return dungeon.describeSelection(ownerKind, ownerId);
    }
    public List<DungeonMapSummary> visibleMaps() {
        return List.copyOf(visibleMaps);
    }
    @Override
    public @Nullable DungeonMapSummary selectedSummary() {
        return super.selectedSummary();
    }
    public @Nullable BaseMapSnapshot loadedSnapshot() {
        return loadedSnapshot;
    }
    public boolean hasLoadedMap() {
        return loadedSnapshot != null;
    }
    public boolean canLoadSelected() {
        return selectedSummary() != null;
    }
    public boolean canApplyEditorOperation() {
        return loadedSnapshot != null;
    }
    public DungeonOverlaySettings overlaySettings() {
        return overlaySettings;
    }
    public String statusText() {
        return state().statusText();
    }
    public int currentFloor() {
        return currentFloor;
    }
    public String lastMutationSummary() {
        return lastMutationSummary;
    }
    @Override
    public List<String> lastMutationMessages() {
        return List.copyOf(lastMutationMessages);
    }
    @Override
    public DungeonMapSurfaceViewState viewState() {
        return new DungeonMapSurfaceViewState(
                visibleMaps.stream().map(DungeonMapSurfaceController::toViewSummary).toList(),
                selectedSummary() == null ? null : toViewSummary(selectedSummary()),
                loadedSnapshot == null ? null : toViewLoadedMap(loadedSnapshot),
                currentFloor,
                overlaySettings,
                lastMutationSummary,
                lastMutationMessages);
    }
    @Override
    public void selectMap(@Nullable Long mapId) {
        selectMap(mapId == null ? null : new src.domain.dungeon.api.DungeonMapId(mapId));
    }
    @Override
    public void loadSelected(DungeonViewportViewModel viewport) {
        loadSelected(toDomainViewport(viewport));
    }
    @Override
    public void createMap(String mapName, DungeonViewportViewModel viewport) {
        createMap(mapName, toDomainViewport(viewport));
    }
    @Override
    public void stepFloor(int delta, DungeonViewportViewModel viewport) {
        stepFloor(delta, toDomainViewport(viewport));
    }
    @Override
    public void updateOverlay(DungeonOverlaySettings settings, DungeonViewportViewModel viewport) {
        updateOverlay(settings, toDomainViewport(viewport));
    }
    @Override
    public void moveRoomAnchor(
            int deltaQ,
            int deltaR,
            @Nullable DungeonSelectionItemViewModel selectedTarget,
            DungeonViewportViewModel viewport
    ) {
        if (selectedTarget == null || !"room".equalsIgnoreCase(selectedTarget.ownerKind())) {
            return;
        }
        applyEditorOperation(new DungeonEditorOperation.MoveRoomAnchor(deltaQ, deltaR), toDomainViewport(viewport));
    }
    public void stepFloor(int delta, Viewport viewport) {
        int nextFloor = Math.max(0, currentFloor + delta);
        if (nextFloor == currentFloor) {
            return;
        }
        currentFloor = nextFloor;
        reloadLoaded(viewport);
    }
    public void updateOverlay(DungeonOverlaySettings settings, Viewport viewport) {
        overlaySettings = settings == null ? DungeonOverlaySettings.defaults() : settings;
        reloadLoaded(viewport);
    }
    public void updateOverlayMode(DungeonOverlayMode mode, Viewport viewport) {
        updateOverlay(overlaySettings.withMode(mode), viewport);
    }
    public void updateOverlayRange(int range, Viewport viewport) {
        updateOverlay(overlaySettings.withLevelRange(range), viewport);
    }
    public void updateOverlayOpacity(double opacity, Viewport viewport) {
        updateOverlay(overlaySettings.withOpacity(opacity), viewport);
    }
    public void updateSelectedOverlayLevels(List<Integer> selectedLevels, Viewport viewport) {
        updateOverlay(overlaySettings.withSelectedLevels(selectedLevels), viewport);
    }
    public void applyEditorOperation(DungeonEditorOperation operation, Viewport viewport) {
        if (loadedMapId == null || operation == null) {
            return;
        }
        DungeonOperationResult result = dungeon.applyOperation(operation);
        lastMutationSummary = result.reactionMessages().isEmpty()
                ? "Editor-Aktion ausgeführt."
                : result.reactionMessages().getFirst();
        lastMutationMessages = mergeMessages(result.validationMessages(), result.reactionMessages());
        reloadLoaded(viewport);
    }
    private static Viewport toDomainViewport(DungeonViewportViewModel viewport) {
        DungeonViewportViewModel resolved = viewport == null
                ? new DungeonViewportViewModel(0.0, 0.0, 960.0, 640.0, 1.0)
                : viewport;
        return new Viewport(
                resolved.centerX(),
                resolved.centerY(),
                resolved.canvasWidth(),
                resolved.canvasHeight(),
                resolved.zoom());
    }
    private static DungeonMapSummaryViewModel toViewSummary(DungeonMapSummary summary) {
        return new DungeonMapSummaryViewModel(summary.mapId().value(), summary.mapName(), summary.revision());
    }
    private static DungeonLoadedMapViewModel toViewLoadedMap(BaseMapSnapshot snapshot) {
        return new DungeonLoadedMapViewModel(
                snapshot.mapId().value(),
                snapshot.mapName(),
                snapshot.revision(),
                snapshot.currentFloor(),
                snapshot.selectableTargets().stream()
                        .map(target -> new DungeonSelectionItemViewModel(
                                target.ownerKind(),
                                target.ownerId(),
                                target.partKind(),
                                target.label()))
                        .toList());
    }
}
