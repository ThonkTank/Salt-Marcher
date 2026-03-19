package features.world.dungeonmap.shell.runtime;

import features.world.dungeonmap.canvas.base.DungeonViewMode;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.shell.AbstractDungeonMapView;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import ui.shell.NavigationIcons;

public final class DungeonRuntimeView extends AbstractDungeonMapView {

    private final String title;
    private final boolean editorMode;
    private final VBox controls;
    private final Label zoomLabel = new Label();
    private final Label statusLabel = new Label();

    public DungeonRuntimeView(String title, boolean editorMode, DungeonMapLoadingService loadingService, DungeonMapState state) {
        super(editorMode, loadingService, state);
        this.title = title;
        this.editorMode = editorMode;
        workspace().setViewMode(DungeonViewMode.GRID);
        Button resetButton = new Button("Ansicht zentrieren");
        resetButton.setMaxWidth(Double.MAX_VALUE);
        resetButton.setOnAction(event -> workspace().resetView());

        this.controls = new VBox(10, zoomLabel, statusLabel, resetButton);
        this.controls.setPadding(new Insets(12));
    }

    @Override
    public String getTitle() {
        return title;
    }

    @Override
    public Node getNavigationGraphic() {
        return editorMode ? NavigationIcons.dungeonEditor() : NavigationIcons.dungeon();
    }

    @Override
    public Node getControlsContent() {
        return controls;
    }

    @Override
    protected void onStateRefreshed() {
        statusLabel.setText(state().loading()
                ? "Lade Dungeon..."
                : state().errorMessage() != null
                ? state().errorMessage()
                : state().activeMap().name());
        refreshLabels();
    }

    @Override
    protected void onWorkspaceStateChanged() {
        refreshLabels();
    }

    private void refreshLabels() {
        zoomLabel.setText("Zoom: " + Math.round(workspace().zoom() * 100) + "%");
    }
}
