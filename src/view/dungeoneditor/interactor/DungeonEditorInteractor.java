package src.view.dungeoneditor.interactor;

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

import java.util.Objects;

/**
 * Editor coordination for the dungeon control-panel placeholder slice.
 */
public final class DungeonEditorInteractor extends AbstractDungeonMapInteractor {

    private final DungeonEditorControls controls;
    private final DungeonEditorStatePane statePane;
    private final DungeonSelectionInspectorSupport inspectorSupport;
    private @Nullable MapSelectionRef selectedTarget;
    private DungeonEditorTool activeTool = DungeonEditorTool.SELECT;

    public DungeonEditorInteractor(InspectorSink inspector) {
        super(new DungeonMapPresentation(
                DungeonEditorInteractor::placeholderRenderModel,
                DungeonEditorInteractor::loadedRenderModel
        ), DungeonMapSurfaceController.shared());
        this.controls = new DungeonEditorControls(mapController(), this::currentViewport);
        this.statePane = new DungeonEditorStatePane(mapController(), this::viewportSummary, this::currentViewport);
        this.inspectorSupport = new DungeonSelectionInspectorSupport(mapController(), inspector);
        controls.setOnToolChanged(this::setActiveTool);
        controls.showActiveTool(activeTool);
        statePane.setActiveTool(activeTool);
        statePane.setOnTargetSelected(this::showSelection);
        workspaceView().setViewportListener(ignored -> statePane.refresh());
        workspaceView().setFloorStepListener(delta -> mapController().stepFloor(delta, currentViewport()));
        workspaceView().setCellSelectionListener(this::onCellSelected);
        workspaceView().setSelectedTarget(null, -1L, null);
        finishInitialization();
    }

    public Node controls() {
        return controls;
    }

    public Node state() {
        return statePane.content();
    }

    private void setActiveTool(DungeonEditorTool tool) {
        activeTool = tool == null ? DungeonEditorTool.SELECT : tool;
        controls.showActiveTool(activeTool);
        statePane.setActiveTool(activeTool);
    }

    private void onCellSelected(MapCellViewModel cellViewModel) {
        showSelection(resolveSelection(cellViewModel));
    }

    private void showSelection(@Nullable MapSelectionRef selectionRef) {
        selectedTarget = selectionRef;
        if (selectionRef == null) {
            workspaceView().setSelectedTarget(null, -1L, null);
        } else {
            workspaceView().setSelectedTarget(selectionRef.ownerKind(), selectionRef.ownerId(), selectionRef.partKind());
        }
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
        MapWorkspaceSceneViewData scene = MapWorkspaceSupport.toSceneViewData(snapshot.renderPayload(), snapshot.currentFloor());
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
            if (!Objects.equals(resolved, selectedTarget)) {
                showSelection(resolved);
            }
        }
        controls.refresh();
        statePane.refresh();
    }

    private String viewportSummary() {
        var viewport = workspaceView().currentViewport();
        return String.format(
                "center=(%.2f, %.2f)  size=(%.0f x %.0f)  zoom=%.2f",
                viewport.centerX(),
                viewport.centerY(),
                viewport.canvasWidth(),
                viewport.canvasHeight(),
                viewport.zoom());
    }
}
