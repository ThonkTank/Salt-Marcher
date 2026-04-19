package src.view.dungeonshared.assembly;
import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.mapcore.api.MapSelectionRef;
import src.view.dungeonshared.ViewModel.DungeonSelectionPublisher;
import src.view.dungeonshared.View.DungeonEditorControls;
import src.view.dungeonshared.View.DungeonEditorStatePane;
import src.view.dungeonshared.ViewModel.DungeonEditorTool;
import src.view.dungeonshared.ViewModel.DungeonSelectionItemViewModel;
import src.view.dungeonshared.ViewModel.DungeonViewportViewModel;
import src.view.mapcanvas.api.MapCanvasCell;
import src.view.mapcanvas.api.MapCanvasRenderModel;
import src.view.mapcanvas.api.MapCanvasScene;
import java.util.function.Consumer;
import java.util.function.Supplier;
/**
 * Editor coordination for the dungeon control-panel placeholder slice.
 */
public final class DungeonEditorInteractor extends AbstractDungeonMapInteractor {
    private final DungeonEditorControls controls;
    private final Supplier<Node> controlsNode;
    private final DungeonEditorStatePane statePane;
    private final Consumer<@Nullable MapSelectionRef> selectionSink;
    private @Nullable MapSelectionRef selectedTarget;
    private DungeonEditorTool activeTool = DungeonEditorTool.defaultTool();
    public DungeonEditorInteractor(DungeonSelectionPublisher selectionPublisher) {
        super(new DungeonMapPresentation(
                DungeonEditorInteractor::placeholderRenderModel,
                DungeonEditorInteractor::loadedRenderModel
        ), DungeonMapSurfaceController.shared());
        this.controls = new DungeonEditorControls(mapController(), this::currentMapCanvasViewport);
        this.controlsNode = () -> controls;
        this.statePane = new DungeonEditorStatePane(mapController(), this::viewportSummary, this::currentMapCanvasViewport);
        this.selectionSink = selectionRef -> applySelection(selectionPublisher, selectionRef);
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
        return controlsNode.get();
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
    private void onCellSelected(MapCanvasCell cellViewModel) {
        showSelection(resolveSelection(cellViewModel));
    }
    private void showSelection(@Nullable MapSelectionRef selectionRef) {
        selectedTarget = selectionRef;
        selectionSink.accept(selectionRef);
        statePane.showSelectedTarget(DungeonMapSelectionMapper.toView(selectionRef));
    }
    private void showSelection( DungeonSelectionItemViewModel selection) {
        showSelection(DungeonMapSelectionMapper.toDomain(loadedSnapshot(), selection));
    }
    private static MapCanvasRenderModel placeholderRenderModel() {
        return new MapCanvasRenderModel(
                "Dungeon Editor",
                "Originalnaeherer Grid-Workspace mit lokaler Kamera",
                "EDITOR",
                "Kein Dungeon geladen",
                "Waehle oder erstelle einen Dungeon ueber die linken Controls.",
                false,
                "Kein Dungeon ausgewaehlt.",
                MapCanvasScene.empty()
        );
    }
    private static MapCanvasRenderModel loadedRenderModel(BaseMapSnapshot snapshot) {
        MapCanvasScene scene = DungeonMapRenderMapper.toSceneViewData(snapshot.renderPayload(), snapshot.currentFloor());
        String overlayMessage = scene.cells().isEmpty()
                ? "Für Ebene z=" + snapshot.currentFloor() + " existiert noch keine gerenderte Placeholder-Geometrie."
                : "";
        return new MapCanvasRenderModel(
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
        var viewport = currentMapCanvasViewport();
        return String.format(
                "center=(%.2f, %.2f)  size=(%.0f x %.0f)  zoom=%.2f",
                viewport.centerX(),
                viewport.centerY(),
                viewport.canvasWidth(),
                viewport.canvasHeight(),
                viewport.zoom());
    }
    private DungeonViewportViewModel currentMapCanvasViewport() {
        var viewport = workspaceSession().currentViewport();
        return new DungeonViewportViewModel(
                viewport.centerX(),
                viewport.centerY(),
                viewport.canvasWidth(),
                viewport.canvasHeight(),
                viewport.zoom());
    }
}
