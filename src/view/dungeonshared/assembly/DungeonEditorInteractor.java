package src.view.dungeonshared.assembly;
import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.mapcore.api.MapSelectionRef;
import src.view.dungeonshared.api.DungeonSelectionPublisher;
import src.view.dungeonshared.View.DungeonEditorControls;
import src.view.dungeonshared.View.DungeonEditorStatePane;
import src.view.dungeonshared.ViewModel.DungeonEditorTool;
import src.view.dungeonshared.ViewModel.DungeonSelectionItemViewModel;
import src.view.dungeonshared.ViewModel.DungeonViewportViewModel;
import src.view.mapshared.api.MapCellViewModel;
import src.view.mapshared.api.MapWorkspaceRenderModel;
import src.view.mapshared.api.MapWorkspaceSceneViewData;
/**
 * Editor coordination for the dungeon control-panel placeholder slice.
 */
public final class DungeonEditorInteractor extends AbstractDungeonMapInteractor {
    private final DungeonEditorControls controls;
    private final DungeonEditorStatePane statePane;
    private final DungeonSelectionPublisher selectionPublisher;
    private @Nullable MapSelectionRef selectedTarget;
    private DungeonEditorTool activeTool = DungeonEditorTool.defaultTool();
    public DungeonEditorInteractor(DungeonSelectionPublisher selectionPublisher) {
        super(new DungeonMapPresentation(
                DungeonEditorInteractor::placeholderRenderModel,
                DungeonEditorInteractor::loadedRenderModel
        ), DungeonMapSurfaceController.shared());
        this.controls = new DungeonEditorControls(mapController(), this::currentMapViewport);
        this.statePane = new DungeonEditorStatePane(mapController(), this::viewportSummary, this::currentMapViewport);
        this.selectionPublisher = selectionPublisher;
        controls.setOnToolChanged(this::setActiveTool);
        controls.showActiveTool(activeTool);
        statePane.setActiveTool(activeTool);
        statePane.setOnTargetSelected(this::showSelection);
        workspaceSession().setViewportListener(ignored -> statePane.refresh());
        workspaceSession().setFloorStepListener(delta -> mapController().stepFloor(delta, currentViewport()));
        workspaceSession().setCellSelectionListener(this::onCellSelected);
        workspaceSession().setSelectedTarget(null, -1L, null);
        finishInitialization();
    }
    public Node controls() {
        return controls;
    }
    public Node workspaceNode() {
        return workspace();
    }
    public Node state() {
        return statePane.content();
    }
    private void setActiveTool(DungeonEditorTool tool) {
        activeTool = tool == null ? DungeonEditorTool.defaultTool() : tool;
        controls.showActiveTool(activeTool);
        statePane.setActiveTool(activeTool);
    }
    private void onCellSelected(MapCellViewModel cellViewModel) {
        showSelection(resolveSelection(cellViewModel));
    }
    private void showSelection(@Nullable MapSelectionRef selectionRef) {
        selectedTarget = selectionRef;
        applySelection(selectionPublisher, selectionRef);
        statePane.showSelectedTarget(DungeonMapSelectionMapper.toView(selectionRef));
    }
    private void showSelection( DungeonSelectionItemViewModel selection) {
        showSelection(DungeonMapSelectionMapper.toDomain(loadedSnapshot(), selection));
    }
    private static MapWorkspaceRenderModel placeholderRenderModel() {
        return new MapWorkspaceRenderModel(
                "Dungeon Editor",
                "Originalnaeherer Grid-Workspace mit lokaler Kamera",
                "EDITOR",
                "Kein Dungeon geladen",
                "Waehle oder erstelle einen Dungeon ueber die linken Controls.",
                false,
                "Kein Dungeon ausgewaehlt.",
                MapWorkspaceSceneViewData.empty()
        );
    }
    private static MapWorkspaceRenderModel loadedRenderModel(BaseMapSnapshot snapshot) {
        MapWorkspaceSceneViewData scene = DungeonMapRenderMapper.toSceneViewData(snapshot.renderPayload(), snapshot.currentFloor());
        String overlayMessage = scene.cells().isEmpty()
                ? "Für Ebene z=" + snapshot.currentFloor() + " existiert noch keine gerenderte Placeholder-Geometrie."
                : "";
        return new MapWorkspaceRenderModel(
                snapshot.mapName(),
                "Editor-Canvas im Look des Originals",
                "EDITOR",
                "Revision " + snapshot.revision() + "  |  Ebene " + snapshot.currentFloor(),
                "Pan und Zoom bleiben lokal. Sichtbare Werkzeuge folgen dem Original-Look, nutzen aber nur die vorhandenen Domain-Capabilities.",
                true,
                overlayMessage,
                scene
        );
    }
    @Override
    protected void onSnapshotChanged() {
        refreshSelection(selectedTarget, this::showSelection);
        controls.refresh();
        statePane.refresh();
    }
    private String viewportSummary() {
        var viewport = currentMapViewport();
        return String.format(
                "center=(%.2f, %.2f)  size=(%.0f x %.0f)  zoom=%.2f",
                viewport.centerX(),
                viewport.centerY(),
                viewport.canvasWidth(),
                viewport.canvasHeight(),
                viewport.zoom());
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
