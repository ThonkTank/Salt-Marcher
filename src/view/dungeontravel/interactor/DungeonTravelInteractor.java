package src.view.dungeontravel.interactor;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
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
 * Travel/runtime coordination for the first real dungeon map slice.
 */
public final class DungeonTravelInteractor {

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

    public DungeonTravelInteractor(InspectorSink inspector) {
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
                        MapWorkspaceSupport.muted("Shared map metadata is visible in travel too"),
                        searchField,
                        mapList,
                        loadButton),
                MapWorkspaceSupport.card(
                        "Map Create",
                        MapWorkspaceSupport.muted("Travel shares the same authored map repository"),
                        createNameField,
                        createButton),
                MapWorkspaceSupport.card(
                        "Floor",
                        MapWorkspaceSupport.muted("Floor hotkeys are active on the focused canvas"),
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
                "Dungeon Travel",
                "Shared camera and unbounded square grid",
                "TRAVEL",
                "No map loaded",
                "Travel uses the same real map metadata and camera surface as the editor.",
                false,
                "No map selected.",
                MapRenderPayload.empty()
        ));
        syncButtonState();
    }

    private MapWorkspaceRenderModel toLoadedRenderModel(BaseMapSnapshot snapshot) {
        return new MapWorkspaceRenderModel(
                snapshot.mapName(),
                "Travel canvas over persisted map metadata",
                "TRAVEL",
                "Revision " + snapshot.revision() + "  |  Floor " + snapshot.currentFloor(),
                "Room logic and party marker stay out of this first slice.",
                true,
                snapshot.topologyEmpty() ? "Map loaded. No topology authored yet." : "",
                snapshot.renderPayload()
        );
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

    private Viewport toDomainViewport(MapViewport viewport) {
        return new Viewport(
                viewport.centerX(),
                viewport.centerY(),
                viewport.canvasWidth(),
                viewport.canvasHeight(),
                viewport.zoom());
    }
}
