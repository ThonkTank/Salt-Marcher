package src.view.dungeonmap.api.internal;
import java.util.Objects;
import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.Label;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.mapcore.api.MapSelectionRef;
import src.view.dungeonmap.api.DungeonSelectionPublisher;
import src.view.dungeonmap.View.DungeonTravelControls;
import src.view.dungeonmap.View.DungeonTravelStatePane;
import src.view.dungeonmap.api.DungeonViewportViewModel;
import src.view.mapcanvas.api.MapCanvasLayer;
import src.view.mapcanvas.api.MapCanvasRenderModel;
import src.view.mapcanvas.api.MapCanvasScene;
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
        this.controls = new DungeonTravelControls(mapController(), () -> workspaceSession().currentViewport().zoom(), this::currentMapCanvasViewport);
        this.statePane = new DungeonTravelStatePane(mapController(), this::currentMapCanvasViewport);
        this.selectionHandler = selectionRef -> showSelection(checkedSelectionPublisher, selectionRef);
        statePane.setOnTargetSelected(selection -> showSelection(
                checkedSelectionPublisher,
                DungeonMapSelectionMapper.toDomain(loadedSnapshot(), selection)));
        workspaceSession().setViewportListener(ignored -> controls.refresh());
        workspaceSession().setFloorStepListener(delta -> mapController().stepFloor(delta, currentViewport()));
        workspaceSession().setCellSelectionListener(cellViewModel ->
                selectionHandler.accept(resolveSelection(cellViewModel)));
        workspaceSession().setSelectedTarget(null, -1L, null);
        workspaceSession().setLayerContent(MapCanvasLayer.ACTOR_OVERLAY, partyToken());
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
    private static MapCanvasRenderModel placeholderRenderModel() {
        return new MapCanvasRenderModel(
                "Dungeon Travel",
                "Originalnaeherer Runtime-Workspace mit lokaler Kamera",
                "TRAVEL",
                "Kein Dungeon geladen",
                "Lade oder erstelle links einen Dungeon.",
                false,
                "Kein Dungeon ausgewaehlt.",
                MapCanvasScene.empty()
        );
    }
    private static MapCanvasRenderModel loadedRenderModel(BaseMapSnapshot snapshot) {
        MapCanvasScene scene = DungeonMapRenderMapper.toSceneViewData(snapshot.renderPayload(), snapshot.currentFloor());
        String overlayMessage = scene.cells().isEmpty()
                ? "Für Ebene z=" + snapshot.currentFloor() + " existiert noch keine Runtime-Placeholder-Geometrie."
                : "";
        return new MapCanvasRenderModel(
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
    private static Node partyToken() {
        Label token = new Label("Party");
        token.getStyleClass().addAll("mode-badge", "party-token");
        token.setLayoutX(16.0);
        token.setLayoutY(16.0);
        return token;
    }
    @Override
    protected void onSnapshotChanged() {
        refreshSelection(selectedTarget, selectionHandler);
        controls.refresh();
        statePane.refresh();
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
