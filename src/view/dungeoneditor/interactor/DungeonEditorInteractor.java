package src.view.dungeoneditor.interactor;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ListView;
import javafx.scene.control.Spinner;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import shell.host.InspectorSink;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.dungeon.api.CreateDungeonMapCommand;
import src.domain.dungeon.api.CreateDungeonMapResult;
import src.domain.dungeon.api.DeleteDungeonMapCommand;
import src.domain.dungeon.api.DungeonMapId;
import src.domain.dungeon.api.DungeonMapSummary;
import src.domain.dungeon.api.LoadMapSnapshotQuery;
import src.domain.dungeon.api.OnionConfig;
import src.domain.dungeon.api.SearchMapsQuery;
import src.domain.dungeon.api.Viewport;
import src.domain.dungeon.dungeonAPI;
import src.domain.mapcore.api.MapRenderPayload;
import src.view.mapshared.Model.MapViewport;
import src.view.mapshared.Model.MapWorkspaceRenderModel;
import src.view.mapshared.View.MapWorkspaceView;
import src.view.mapshared.interactor.MapWorkspaceSupport;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Editor coordination for the first real dungeon map slice.
 */
public final class DungeonEditorInteractor {

    private final dungeonAPI dungeon;
    private final MapWorkspaceView workspaceView;
    private final VBox controls = new VBox(8);
    private final VBox state = new VBox(8);
    private final TextField searchField = new TextField();
    private final ListView<DungeonMapSummary> mapList = new ListView<>();
    private final TextField createNameField = new TextField();
    private final Button loadButton = new Button("Load map");
    private final Button createButton = new Button("Create map");
    private final Button deleteButton = new Button("Delete loaded");
    private final Spinner<Integer> floorSpinner = new Spinner<>(0, 0, 0);

    private final OnionConfig onionConfig = OnionConfig.defaults();

    private @Nullable DungeonMapId loadedMapId;
    private @Nullable BaseMapSnapshot loadedSnapshot;
    private boolean loadingMap;

    public DungeonEditorInteractor(InspectorSink inspector) {
        this.dungeon = new dungeonAPI();
        this.workspaceView = new MapWorkspaceView();
        this.workspaceView.setViewportListener(ignored -> reloadLoadedMap());
        this.workspaceView.setFloorStepListener(this::stepFloor);
        buildControls();
        refreshSearchResults();
        showPlaceholder();
    }

    public Node controls() {
        return controls;
    }

    public Node workspace() {
        return workspaceView;
    }

    public Node state() {
        return state;
    }

    private void buildControls() {
        controls.getStyleClass().addAll("dungeon-editor-toolbar", "dungeon-editor-sidebar");
        controls.setPadding(new Insets(12));
        controls.setFillWidth(true);

        searchField.setPromptText("Search maps");
        searchField.textProperty().addListener((ignored, before, after) -> refreshSearchResults());

        mapList.setPrefHeight(220.0);
        mapList.getSelectionModel().selectedItemProperty().addListener((ignored, before, after) -> syncButtonState());
        mapList.setOnMouseClicked(event -> {
            if (event.getClickCount() == 2) {
                loadSelectedMap();
            }
        });

        loadButton.setMaxWidth(Double.MAX_VALUE);
        loadButton.setOnAction(event -> loadSelectedMap());

        createNameField.setPromptText("Dungeon Nr.X");
        createNameField.textProperty().addListener((ignored, before, after) -> syncButtonState());
        createButton.setMaxWidth(Double.MAX_VALUE);
        createButton.setOnAction(event -> createAndLoadMap());

        deleteButton.setMaxWidth(Double.MAX_VALUE);
        deleteButton.setOnAction(event -> deleteLoadedMap());

        floorSpinner.setEditable(false);
        floorSpinner.setPrefWidth(Double.MAX_VALUE);
        floorSpinner.valueProperty().addListener((ignored, before, after) -> {
            if (!loadingMap && loadedMapId != null && after != null && after == 0) {
                reloadLoadedMap();
            }
        });

        controls.getChildren().setAll(
                MapWorkspaceSupport.card(
                        "Map Search",
                        MapWorkspaceSupport.muted("Persisted dungeon map metadata"),
                        searchField,
                        mapList,
                        loadButton),
                MapWorkspaceSupport.card(
                        "Map Create",
                        MapWorkspaceSupport.muted("Creates a real empty dungeon aggregate"),
                        createNameField,
                        createButton),
                MapWorkspaceSupport.card(
                        "Map State",
                        MapWorkspaceSupport.muted("Floor controls are clamped to floor 0 in v1"),
                        floorSpinner,
                        deleteButton)
        );

        createNameField.setText(defaultMapName());
        syncButtonState();
    }

    private void refreshSearchResults() {
        List<DungeonMapSummary> matches = dungeon.searchMaps(new SearchMapsQuery(searchField.getText()));
        mapList.getItems().setAll(matches);
        restoreSelection(matches);
        if (createNameField.getText().isBlank()) {
            createNameField.setText(defaultMapName());
        }
        syncButtonState();
    }

    private void restoreSelection(List<DungeonMapSummary> matches) {
        if (loadedMapId == null) {
            return;
        }
        for (DungeonMapSummary match : matches) {
            if (match.mapId().equals(loadedMapId)) {
                mapList.getSelectionModel().select(match);
                return;
            }
        }
    }

    private void loadSelectedMap() {
        DungeonMapSummary selected = mapList.getSelectionModel().getSelectedItem();
        if (selected == null) {
            return;
        }
        loadMap(selected.mapId());
    }

    private void createAndLoadMap() {
        CreateDungeonMapResult result = dungeon.createMap(new CreateDungeonMapCommand(createNameField.getText()));
        createNameField.setText(defaultMapName());
        refreshSearchResults();
        loadMap(result.mapId());
    }

    private void deleteLoadedMap() {
        if (loadedMapId == null) {
            return;
        }
        dungeon.deleteMap(new DeleteDungeonMapCommand(loadedMapId));
        loadedMapId = null;
        loadedSnapshot = null;
        refreshSearchResults();
        showPlaceholder();
    }

    private void loadMap(DungeonMapId mapId) {
        loadingMap = true;
        try {
            loadedSnapshot = dungeon.loadMapSnapshot(new LoadMapSnapshotQuery(mapId, 0, onionConfig, toDomainViewport(workspaceView.currentViewport())));
            loadedMapId = loadedSnapshot.mapId();
            floorSpinner.getValueFactory().setValue(loadedSnapshot.currentFloor());
            mapList.getItems().stream()
                    .filter(item -> item.mapId().equals(loadedMapId))
                    .findFirst()
                    .ifPresent(match -> mapList.getSelectionModel().select(match));
            workspaceView.show(toLoadedRenderModel(loadedSnapshot));
            refreshState();
            syncButtonState();
        } finally {
            loadingMap = false;
        }
    }

    private void reloadLoadedMap() {
        if (loadedMapId == null) {
            return;
        }
        loadMap(loadedMapId);
    }

    private void stepFloor(int delta) {
        if (loadedMapId == null) {
            return;
        }
        floorSpinner.getValueFactory().setValue(0);
        reloadLoadedMap();
    }

    private void showPlaceholder() {
        workspaceView.show(new MapWorkspaceRenderModel(
                "Dungeon Editor",
                "Shared camera and unbounded square grid",
                "EDITOR",
                "No map loaded",
                "Search, create, load, or delete real dungeon map metadata.",
                false,
                "No map selected.",
                MapRenderPayload.empty()
        ));
        refreshState();
        syncButtonState();
    }

    private MapWorkspaceRenderModel toLoadedRenderModel(BaseMapSnapshot snapshot) {
        return new MapWorkspaceRenderModel(
                snapshot.mapName(),
                "Editor canvas over persisted map metadata",
                "EDITOR",
                "Revision " + snapshot.revision() + "  |  Floor " + snapshot.currentFloor(),
                "Viewport-clipped snapshot request active. Floor controls are clamped to 0 in v1.",
                true,
                snapshot.topologyEmpty() ? "Map loaded. No topology authored yet." : "",
                snapshot.renderPayload()
        );
    }

    private void refreshState() {
        state.getStyleClass().addAll("dungeon-editor-sidebar", "scene-pane");
        state.setPadding(new Insets(12));
        if (loadedSnapshot == null) {
            state.getChildren().setAll(
                    MapWorkspaceSupport.card(
                            "Loaded Map",
                            new Label("None"),
                            MapWorkspaceSupport.muted("Empty dungeon aggregates can be created from the toolbar."))
            );
            return;
        }
        Label mapId = new Label("Map ID: " + loadedSnapshot.mapId().value());
        Label revision = new Label("Revision: " + loadedSnapshot.revision());
        Label floor = new Label("Current floor: " + loadedSnapshot.currentFloor());
        Label viewport = new Label(viewportSummary());
        viewport.setWrapText(true);
        state.getChildren().setAll(
                MapWorkspaceSupport.card(
                        "Loaded Map",
                        mapId,
                        revision,
                        floor,
                        MapWorkspaceSupport.muted("Viewport"),
                        viewport)
        );
    }

    private String viewportSummary() {
        var viewport = workspaceView.currentViewport();
        return String.format(
                "center=(%.2f, %.2f)  size=(%.0f x %.0f)  zoom=%.2f",
                viewport.centerX(),
                viewport.centerY(),
                viewport.canvasWidth(),
                viewport.canvasHeight(),
                viewport.zoom());
    }

    private Viewport toDomainViewport(MapViewport viewport) {
        return new Viewport(
                viewport.centerX(),
                viewport.centerY(),
                viewport.canvasWidth(),
                viewport.canvasHeight(),
                viewport.zoom());
    }

    private void syncButtonState() {
        loadButton.setDisable(mapList.getSelectionModel().getSelectedItem() == null);
        deleteButton.setDisable(loadedMapId == null);
        createButton.setDisable(createNameField.getText().trim().isBlank());
    }

    private String defaultMapName() {
        Set<String> names = new HashSet<>();
        for (DungeonMapSummary summary : dungeon.searchMaps(new SearchMapsQuery(""))) {
            names.add(summary.mapName());
        }
        int next = 1;
        while (names.contains("Dungeon Nr." + next)) {
            next++;
        }
        return "Dungeon Nr." + next;
    }
}
