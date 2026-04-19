package src.view.dungeonshared.assembly;
import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.dungeon.api.Viewport;
import src.domain.mapcore.api.MapSelectionRef;
import src.view.dungeonshared.api.DungeonSelectionInspectorEntry;
import src.view.dungeonshared.api.DungeonSelectionPublisher;
import src.view.mapshared.api.MapCellViewModel;
import src.view.mapshared.api.MapWorkspaceSession;
import java.util.function.Consumer;
/**
 * Shared map-list workflow for dungeon editor and travel tabs.
 */
// PMD suppression is local: this shared base intentionally owns the reusable dungeon workspace contract; see src/view/dungeoneditor/UI.md.
@SuppressWarnings("PMD.TooManyMethods")
public abstract class AbstractDungeonMapInteractor {
    private final MapWorkspaceSession workspaceSession = MapWorkspaceSession.create();
    private final DungeonMapPresentation presentation;
    private final DungeonMapSurfaceController mapController;
    protected AbstractDungeonMapInteractor(DungeonMapPresentation presentation, DungeonMapSurfaceController mapController) {
        this.presentation = presentation;
        this.mapController = mapController;
        this.mapController.addListener(this::refreshWorkspace);
    }
    protected final void finishInitialization() {
        mapController.refreshMaps();
        refreshWorkspace();
    }
    public final Node workspace() {
        return workspaceSession.node();
    }
    protected final MapWorkspaceSession workspaceSession() {
        return workspaceSession;
    }
    protected final @Nullable BaseMapSnapshot loadedSnapshot() {
        return mapController.state().loadedSnapshot();
    }
    protected final DungeonMapSurfaceController mapController() {
        return mapController;
    }
    protected final @Nullable MapSelectionRef resolveSelection(@Nullable MapCellViewModel cellViewModel) {
        return DungeonMapSelectionMapper.resolveSelection(loadedSnapshot(), cellViewModel);
    }
    protected final void applySelection(
            DungeonSelectionPublisher selectionPublisher,
            @Nullable MapSelectionRef selectionRef
    ) {
        DungeonMapSelectionMapper.applySelection(
                workspaceSession(),
                ref -> publishSelection(selectionPublisher, ref),
                selectionRef);
    }
    protected final void refreshSelection(
            @Nullable MapSelectionRef selectedTarget,
            Consumer<MapSelectionRef> selectionConsumer
    ) {
        DungeonMapSelectionMapper.refreshSelection(loadedSnapshot(), selectedTarget, selectionConsumer);
    }
    protected final Viewport currentViewport() {
        var viewport = workspaceSession.currentViewport();
        return new Viewport(
                viewport.centerX(),
                viewport.centerY(),
                viewport.canvasWidth(),
                viewport.canvasHeight(),
                viewport.zoom());
    }
    private void refreshWorkspace() {
        BaseMapSnapshot snapshot = mapController.state().loadedSnapshot();
        workspaceSession.show(snapshot == null
                ? presentation.placeholderRenderModel().get()
                : presentation.loadedRenderModel().apply(snapshot));
        onSnapshotChanged();
    }
    private void publishSelection(
            DungeonSelectionPublisher selectionPublisher,
            @Nullable MapSelectionRef selectionRef
    ) {
        if (selectionRef == null) {
            selectionPublisher.clear();
            return;
        }
        var snapshot = mapController().describeSelection(selectionRef.ownerKind(), selectionRef.ownerId());
        selectionPublisher.showSelection(new DungeonSelectionInspectorEntry(
                selectionRef.label(),
                "dungeon:" + selectionRef.ownerKind() + ":" + selectionRef.ownerId() + ":" + selectionRef.partKind(),
                snapshot.title(),
                snapshot.summary(),
                snapshot.facts()));
    }
    protected void onSnapshotChanged() {
    }
}
