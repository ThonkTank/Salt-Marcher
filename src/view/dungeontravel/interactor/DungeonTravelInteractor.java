package src.view.dungeontravel.interactor;

import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import shell.host.InspectorSink;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.mapcore.api.MapSelectionRef;
import src.view.dungeonshared.interactor.AbstractDungeonMapInteractor;
import src.view.dungeonshared.interactor.DungeonMapPresentation;
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
        workspaceView().setSelectedTarget(null);
        finishInitialization();
    }

    public Node controls() {
        return controls.content();
    }

    public Node state() {
        return statePane.content();
    }

    private void onCellSelected(MapCellViewModel cellViewModel) {
        showSelection(resolveSelection(cellViewModel));
    }

    private void showSelection(@Nullable MapSelectionRef selectionRef) {
        selectedTarget = selectionRef;
        workspaceView().setSelectedTarget(selectionRef);
        statePane.showSelectedTarget(selectionRef);
        inspectorSupport.showSelection(selectionRef);
    }

    private @Nullable MapSelectionRef resolveSelection(MapCellViewModel cellViewModel) {
        BaseMapSnapshot snapshot = loadedSnapshot();
        if (snapshot == null || cellViewModel == null) {
            return null;
        }
        return snapshot.selectableTargets().stream()
                .filter(target -> target.ownerId() == cellViewModel.ownerId())
                .filter(target -> target.ownerKind().equalsIgnoreCase(cellViewModel.ownerKind()))
                .filter(target -> target.partKind().equalsIgnoreCase(cellViewModel.partKind()))
                .findFirst()
                .orElse(null);
    }

    private static MapWorkspaceRenderModel placeholderRenderModel() {
        return new MapWorkspaceRenderModel(
                "Dungeon Travel",
                "Shared camera and unbounded square grid",
                "TRAVEL",
                "No map loaded",
                "Use the control panel to load or create a dungeon.",
                false,
                "No map selected.",
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
                "Travel canvas over committed dungeon placeholder truth",
                "TRAVEL",
                "Revision " + snapshot.revision() + "  |  Floor " + snapshot.currentFloor(),
                "Pan/zoom sind lokal. Party-Token und Travel-Actions bleiben angedockte Placeholder, bis die Runtime-Domain bereit ist.",
                true,
                overlayMessage,
                scene
        );
    }

    @Override
    protected void onSnapshotChanged() {
        BaseMapSnapshot snapshot = loadedSnapshot();
        if (snapshot == null) {
            if (selectedTarget != null) {
                showSelection(null);
            }
        } else if (selectedTarget != null) {
            MapSelectionRef resolved = snapshot.selectableTargets().stream()
                    .filter(target -> target.ownerId() == selectedTarget.ownerId())
                    .filter(target -> target.ownerKind().equalsIgnoreCase(selectedTarget.ownerKind()))
                    .filter(target -> target.partKind().equalsIgnoreCase(selectedTarget.partKind()))
                    .findFirst()
                    .orElse(null);
            if (resolved != selectedTarget) {
                showSelection(resolved);
            }
        }
        controls.refresh();
        statePane.refresh();
    }
}
