package src.view.dungeonshared.assembly;
import java.util.Objects;
import java.util.function.Consumer;
import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.mapcore.api.MapSelectionRef;
import src.view.dungeonshared.ViewModel.DungeonSelectionPublisher;
import src.view.dungeonshared.View.DungeonTravelControls;
import src.view.dungeonshared.View.DungeonTravelStatePane;
import src.view.dungeonshared.ViewModel.DungeonViewportViewModel;
import src.view.mapshared.ViewModel.MapWorkspaceRenderModel;
import src.view.mapshared.ViewModel.MapWorkspaceSceneViewData;
/**
 * Travel/runtime coordination for the dungeon control-panel placeholder slice.
 */
public final class DungeonTravelInteractor extends AbstractDungeonMapInteractor {
    private final DungeonTravelControls controls;
    private final DungeonTravelStatePane statePane;
    private final Consumer<MapSelectionRef> selectionHandler;
    private @Nullable MapSelectionRef selectedTarget;
    public DungeonTravelInteractor(DungeonSelectionPublisher selectionPublisher) {
        super(new DungeonMapPresentation(
                DungeonTravelInteractor::placeholderRenderModel,
                DungeonTravelInteractor::loadedRenderModel
        ), DungeonMapSurfaceController.shared());
        DungeonSelectionPublisher checkedSelectionPublisher =
                Objects.requireNonNull(selectionPublisher, "selectionPublisher");
        this.controls = new DungeonTravelControls(mapController(), () -> workspaceSession().currentViewport().zoom(), this::currentMapViewport);
        this.statePane = new DungeonTravelStatePane(mapController(), this::currentMapViewport);
        this.selectionHandler = selectionRef -> showSelection(checkedSelectionPublisher, selectionRef);
        statePane.setOnTargetSelected(selection -> showSelection(
                checkedSelectionPublisher,
                DungeonMapSelectionMapper.toDomain(loadedSnapshot(), selection)));
        workspaceSession().setViewportListener(ignored -> controls.refresh());
        workspaceSession().setFloorStepListener(delta -> mapController().stepFloor(delta, currentViewport()));
        workspaceSession().setCellSelectionListener(cellViewModel ->
                selectionHandler.accept(resolveSelection(cellViewModel)));
        workspaceSession().setSelectedTarget(null, -1L, null);
        finishInitialization();
    }
    public Node controls() {
        return controls.content();
    }
    public Node workspaceNode() {
        return workspace();
    }
    public Node state() {
        return statePane.content();
    }
    private void showSelection(DungeonSelectionPublisher selectionPublisher, @Nullable MapSelectionRef selectionRef) {
        selectedTarget = selectionRef;
        applySelection(selectionPublisher, selectionRef);
        statePane.showSelectedTarget(DungeonMapSelectionMapper.toView(selectionRef));
    }
    private static MapWorkspaceRenderModel placeholderRenderModel() {
        return new MapWorkspaceRenderModel(
                "Dungeon Travel",
                "Originalnaeherer Runtime-Workspace mit lokaler Kamera",
                "TRAVEL",
                "Kein Dungeon geladen",
                "Lade oder erstelle links einen Dungeon.",
                false,
                "Kein Dungeon ausgewaehlt.",
                MapWorkspaceSceneViewData.empty()
        );
    }
    private static MapWorkspaceRenderModel loadedRenderModel(BaseMapSnapshot snapshot) {
        MapWorkspaceSceneViewData scene = DungeonMapRenderMapper.toSceneViewData(snapshot.renderPayload(), snapshot.currentFloor());
        String overlayMessage = scene.cells().isEmpty()
                ? "Für Ebene z=" + snapshot.currentFloor() + " existiert noch keine Runtime-Placeholder-Geometrie."
                : "";
        return new MapWorkspaceRenderModel(
                snapshot.mapName(),
                "Runtime-Canvas im Look des Originals",
                "TRAVEL",
                "Revision " + snapshot.revision() + "  |  Ebene " + snapshot.currentFloor(),
                "Pan und Zoom bleiben lokal. Runtime-Fokus und Overlay folgen dem Original-Look; Travel-Actions bleiben an die aktuelle Domain gebunden.",
                true,
                overlayMessage,
                scene
        );
    }
    @Override
    protected void onSnapshotChanged() {
        refreshSelection(selectedTarget, selectionHandler);
        controls.refresh();
        statePane.refresh();
    }
    private DungeonViewportViewModel currentMapViewport() {
        var viewport = workspaceSession().currentViewport();
        return new DungeonViewportViewModel(
                viewport.centerX(),
                viewport.centerY(),
                viewport.canvasWidth(),
                viewport.canvasHeight(),
                viewport.zoom());
    }
}
