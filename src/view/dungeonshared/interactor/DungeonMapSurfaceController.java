package src.view.dungeonshared.interactor;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.DungeonEditorOperation;
import src.domain.dungeon.api.DungeonInspectorSnapshot;
import src.domain.dungeon.api.DungeonOperationResult;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.dungeon.api.DungeonMapSummary;
import src.domain.dungeon.api.Viewport;
import src.domain.dungeon.dungeonAPI;

import java.util.List;

/**
 * Shared controller for dungeon map selection, loading, creation, deletion, and placeholder edit hooks.
 */
// PMD suppression is local: this shared controller is the single facade for map-surface actions and state; see src/view/dungeoneditor/UI.md.
@SuppressWarnings("PMD.TooManyMethods")
public final class DungeonMapSurfaceController extends AbstractDungeonMapCatalogController {

    private static final DungeonMapSurfaceController SHARED = new DungeonMapSurfaceController(new dungeonAPI());

    private DungeonMapSurfaceController(dungeonAPI dungeon) {
        super(dungeon);
    }

    public static DungeonMapSurfaceController shared() {
        return SHARED;
    }

    public DungeonInspectorSnapshot describeSelection(String ownerKind, long ownerId) {
        return dungeon.describeSelection(ownerKind, ownerId);
    }

    public List<DungeonMapSummary> visibleMaps() {
        return visibleMaps;
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

    public List<String> lastMutationMessages() {
        return lastMutationMessages;
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
}
