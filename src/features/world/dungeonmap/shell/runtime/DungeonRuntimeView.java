package features.world.dungeonmap.shell.runtime;

import features.world.dungeonmap.application.runtime.DungeonRuntimeNavigationService;
import features.world.dungeonmap.application.runtime.DungeonRuntimePresenter;
import features.world.dungeonmap.canvas.base.DungeonViewMode;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.DungeonRuntimeState;
import features.world.dungeonmap.shell.AbstractDungeonMapView;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import ui.shell.NavigationIcons;
import ui.async.UiAsyncTasks;

import java.util.Objects;

public final class DungeonRuntimeView extends AbstractDungeonMapView {

    private final String title;
    private final boolean editorMode;
    private final DungeonRuntimeNavigationService runtimeNavigationService;
    private final DungeonRuntimeState runtimeState = new DungeonRuntimeState();
    private final VBox controls;
    private final Label zoomLabel = new Label();
    private final Label mapLabel = new Label();
    private final Label locationLabel = new Label();
    private final Label runtimeStatusLabel = new Label();
    private final VBox navigationButtons = new VBox(6);
    private long runtimeRequestSequence;
    private Long runtimeMapId;

    public DungeonRuntimeView(
            String title,
            boolean editorMode,
            DungeonMapLoadingService loadingService,
            DungeonMapState state,
            DungeonRuntimeNavigationService runtimeNavigationService
    ) {
        super(editorMode, loadingService, state);
        this.title = title;
        this.editorMode = editorMode;
        this.runtimeNavigationService = Objects.requireNonNull(runtimeNavigationService, "runtimeNavigationService");
        workspace().setViewMode(DungeonViewMode.GRID);
        workspace().setInteractionHandler(new DungeonRuntimeInteractionController(state, runtimeState, this::movePartyToRoom));
        runtimeState.addListener(this::refreshRuntimeUi);
        Button resetButton = new Button("Ansicht zentrieren");
        resetButton.setMaxWidth(Double.MAX_VALUE);
        resetButton.setOnAction(event -> workspace().resetView());

        this.controls = new VBox(10, zoomLabel, mapLabel, locationLabel, runtimeStatusLabel, navigationButtons, resetButton);
        this.controls.setPadding(new Insets(12));
        refreshRuntimeUi();
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
        refreshRuntimeState();
        refreshLabels();
    }

    @Override
    protected void onWorkspaceStateChanged() {
        refreshLabels();
    }

    private void refreshLabels() {
        zoomLabel.setText("Zoom: " + Math.round(workspace().zoom() * 100) + "%");
        mapLabel.setText(state().loading()
                ? "Lade Dungeon..."
                : state().errorMessage() != null
                ? state().errorMessage()
                : state().activeMap().name());
        locationLabel.setText("Standort: " + DungeonRuntimePresenter.activeLocationLabel(state().activeMap(), runtimeState.activeLocation()));
        runtimeStatusLabel.setText(runtimeStatusText());
        rebuildNavigationButtons();
    }

    private void refreshRuntimeUi() {
        workspace().setActiveLocation(runtimeState.activeLocation());
        refreshLabels();
    }

    private void refreshRuntimeState() {
        if (state().loading()) {
            runtimeState.showLoading();
            return;
        }
        if (state().errorMessage() != null || state().activeMap().mapId() <= 0) {
            runtimeMapId = null;
            runtimeState.clear();
            return;
        }
        if (!Objects.equals(runtimeMapId, state().activeMapId())) {
            runtimeMapId = state().activeMapId();
            loadRuntimeNavigation();
            return;
        }
        runtimeState.showNavigation(runtimeNavigationService.resolveNavigation(state().activeMap(), runtimeState.activeLocation()));
    }

    private void loadRuntimeNavigation() {
        long requestId = ++runtimeRequestSequence;
        var layout = state().activeMap();
        runtimeState.showLoading();
        UiAsyncTasks.submit(
                () -> runtimeNavigationService.loadNavigation(layout),
                snapshot -> {
                    if (requestId != runtimeRequestSequence || !Objects.equals(runtimeMapId, state().activeMapId())) {
                        return;
                    }
                    runtimeState.showNavigation(snapshot);
                },
                failure -> {
                    if (requestId != runtimeRequestSequence) {
                        return;
                    }
                    System.err.println("DungeonRuntimeView.loadRuntimeNavigation(): " + failure.getMessage());
                    runtimeState.showFailure("Standort konnte nicht geladen werden");
                });
    }

    private void movePartyToRoom(long roomId) {
        if (runtimeState.loading() || runtimeState.moving() || state().activeMap().mapId() <= 0) {
            return;
        }
        var layout = state().activeMap();
        runtimeState.showMoveInProgress();
        UiAsyncTasks.submit(
                () -> runtimeNavigationService.moveToRoom(layout, runtimeState.activeLocation(), roomId),
                runtimeState::showNavigation,
                failure -> {
                    System.err.println("DungeonRuntimeView.movePartyToRoom(): " + failure.getMessage());
                    runtimeState.showFailure("Standort konnte nicht gespeichert werden");
                });
    }

    private String runtimeStatusText() {
        if (runtimeState.loading()) {
            return "Standort wird geladen...";
        }
        if (runtimeState.moving()) {
            return "Gruppe bewegt sich...";
        }
        if (runtimeState.errorMessage() != null) {
            return runtimeState.errorMessage();
        }
        return runtimeState.reachableRoomIds().isEmpty()
                ? "Keine angrenzenden Räume"
                : "Angrenzende Räume";
    }

    private void rebuildNavigationButtons() {
        navigationButtons.getChildren().clear();
        for (Long roomId : runtimeState.reachableRoomIds()) {
            Button button = new Button(DungeonRuntimePresenter.roomLabel(state().activeMap(), roomId));
            button.setDisable(runtimeState.loading() || runtimeState.moving());
            button.setMaxWidth(Double.MAX_VALUE);
            button.setOnAction(event -> movePartyToRoom(roomId));
            navigationButtons.getChildren().add(button);
        }
    }
}
