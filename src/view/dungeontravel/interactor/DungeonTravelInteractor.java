package src.view.dungeontravel.interactor;

import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import shell.host.InspectorSink;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.mapcore.api.MapSelectionRef;
import src.view.dungeonshared.interactor.AbstractDungeonMapInteractor;
import src.view.dungeonshared.interactor.DungeonMapPresentation;
import src.view.dungeonshared.interactor.DungeonMapSelectionSupport;
import src.view.dungeonshared.interactor.DungeonMapSurfaceController;
import src.view.dungeonshared.interactor.DungeonSelectionInspectorSupport;
import src.view.mapshared.Model.MapCellViewModel;
import src.view.mapshared.Model.MapWorkspaceRenderModel;
import src.view.mapshared.Model.MapWorkspaceSceneViewData;
import src.view.mapshared.interactor.MapWorkspaceSupport;

/**
 * Travel/runtime coordination for the dungeon control-panel placeholder slice.
 */
public final class DungeonTravelInteractor extends AbstractDungeonMapInteractor {

    private final DungeonTravelControls controls;
    private final DungeonTravelStatePane statePane;
    private final DungeonSelectionInspectorSupport inspectorSupport;
    private @Nullable MapSelectionRef selectedTarget;

    public DungeonTravelInteractor(InspectorSink inspector) {
        super(new DungeonMapPresentation(
                DungeonTravelInteractor::placeholderRenderModel,
                DungeonTravelInteractor::loadedRenderModel
        ), DungeonMapSurfaceController.shared());
        this.controls = new DungeonTravelControls(mapController(), () -> workspaceView().currentViewport().zoom(), this::currentViewport);
        this.statePane = new DungeonTravelStatePane(mapController(), this::currentViewport);
        this.inspectorSupport = new DungeonSelectionInspectorSupport(mapController(), inspector);
        statePane.setOnTargetSelected(this::showSelection);
        workspaceView().setViewportListener(ignored -> controls.refresh());
        workspaceView().setFloorStepListener(delta -> mapController().stepFloor(delta, currentViewport()));
        workspaceView().setCellSelectionListener(this::onCellSelected);
        workspaceView().setSelectedTarget(null, -1L, null);
        finishInitialization();
    }

    public Node controls() {
        return controls.content();
    }

    public Node state() {
        return statePane.content();
    }

    private void onCellSelected(MapCellViewModel cellViewModel) {
        showSelection(DungeonMapSelectionSupport.resolveSelection(loadedSnapshot(), cellViewModel));
    }

    private void showSelection(@Nullable MapSelectionRef selectionRef) {
        selectedTarget = selectionRef;
        DungeonMapSelectionSupport.applySelection(workspaceView(), statePane::showSelectedTarget, inspectorSupport::showSelection, selectionRef);
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
        MapWorkspaceSceneViewData scene = MapWorkspaceSupport.toSceneViewData(snapshot.renderPayload(), snapshot.currentFloor());
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
        DungeonMapSelectionSupport.refreshSelection(loadedSnapshot(), selectedTarget, this::showSelection);
        controls.refresh();
        statePane.refresh();
    }
}
