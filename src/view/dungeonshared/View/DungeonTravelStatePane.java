package src.view.dungeonshared.View;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import src.view.dungeonshared.ViewModel.DungeonLoadedMapViewModel;
import src.view.dungeonshared.ViewModel.DungeonMapSurfaceViewModel;
import src.view.dungeonshared.ViewModel.DungeonMapSummaryViewModel;
import src.view.dungeonshared.ViewModel.DungeonSelectionItemViewModel;
import src.view.dungeonshared.ViewModel.DungeonViewportViewModel;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;
public final class DungeonTravelStatePane {
    private final DungeonMapSurfaceViewModel controller;
    private final Supplier<DungeonViewportViewModel> viewportSupplier;
    private final VBox content = new VBox(12);
    private final TextField searchField = new TextField();
    private final ListView<DungeonMapSummaryViewModel> mapList = new ListView<>();
    private final TextField createNameField = new TextField();
    private final Button loadButton = new Button("Dungeon laden");
    private final Button createButton = new Button("Dungeon anlegen");
    private final Button deleteButton = new Button("Dungeon loeschen");
    private final ListView<DungeonSelectionItemViewModel> objectList = new ListView<>();
    private Consumer<DungeonSelectionItemViewModel> onTargetSelected = ignored -> { };
    private @Nullable DungeonSelectionItemViewModel selectedTarget;
    private boolean syncingSelection;
    public DungeonTravelStatePane(
            DungeonMapSurfaceViewModel controller,
            Supplier<DungeonViewportViewModel> viewportSupplier
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.viewportSupplier = Objects.requireNonNull(viewportSupplier, "viewportSupplier");
        content.getStyleClass().setAll("control-stack", "surface-root");
        content.setPadding(new Insets(12));
        searchField.setPromptText("Dungeon suchen");
        mapList.setPrefHeight(180.0);
        mapList.getSelectionModel().selectedItemProperty().addListener((ignored, before, after) -> {
            if (syncingSelection) {
                return;
            }
            controller.selectMap(after == null ? null : after.mapId());
            refresh();
        });
        mapList.setOnMouseClicked(event -> {
            if (event.getClickCount() == 2) {
                loadButton.fire();
            }
        });
        mapList.setCellFactory(ignored -> new ListCell<>() {
            @Override
            protected void updateItem(DungeonMapSummaryViewModel item, boolean empty) {
                super.updateItem(item, empty);
                setText(empty || item == null ? null : item.toString());
            }
        });
        DungeonMapSelectionSupport.configureSelectionList(objectList, 160.0, () -> syncingSelection, () -> onTargetSelected);
        createNameField.setPromptText("Dungeon Nr.X");
        createNameField.textProperty().addListener((ignored, before, after) -> refresh());
        searchField.textProperty().addListener((ignored, before, after) -> controller.setSearchText(after));
        loadButton.setMaxWidth(Double.MAX_VALUE);
        loadButton.setOnAction(event -> controller.loadSelected(this.viewportSupplier.get()));
        createButton.setMaxWidth(Double.MAX_VALUE);
        createButton.setOnAction(event -> controller.createMap(createNameField.getText(), this.viewportSupplier.get()));
        deleteButton.setMaxWidth(Double.MAX_VALUE);
        deleteButton.setOnAction(event -> controller.deleteLoaded());
        controller.addListener(this::refresh);
        refresh();
    }
    public Node content() {
        return content;
    }
    public void setOnTargetSelected(Consumer<DungeonSelectionItemViewModel> onTargetSelected) {
        this.onTargetSelected = onTargetSelected == null ? ignored -> { } : onTargetSelected;
    }
    public void showSelectedTarget(@Nullable DungeonSelectionItemViewModel selectedTarget) {
        this.selectedTarget = selectedTarget;
        refresh();
    }
    public void refresh() {
        var state = controller.viewState();
        DungeonLoadedMapViewModel snapshot = state.loadedMap();
        syncMapList();
        syncObjectList(snapshot);
        if (createNameField.getText().isBlank()) {
            createNameField.setText(controller.defaultMapName());
        }
        loadButton.setDisable(!state.canLoadSelected());
        createButton.setDisable(createNameField.getText().trim().isEmpty());
        deleteButton.setDisable(!state.hasLoadedMap());
        content.getChildren().setAll(
                mapSearchCard(),
                mapCreateCard(),
                runtimeStateCard(snapshot),
                objectListCard(snapshot)
        );
    }
    private VBox mapSearchCard() {
        return MapWorkspaceSupport.card(
                "Dungeon",
                searchField,
                mapList,
                loadButton);
    }
    private VBox mapCreateCard() {
        return MapWorkspaceSupport.card(
                "Verwaltung",
                createNameField,
                createButton,
                deleteButton);
    }
    private VBox runtimeStateCard(@Nullable DungeonLoadedMapViewModel snapshot) {
        if (snapshot == null) {
            return MapWorkspaceSupport.card(
                "Reiseansicht",
                MapWorkspaceSupport.muted("Lade einen Dungeon, um Runtime-Fokus und Overlay-Ebenen zu sehen."));
        }
        var state = controller.viewState();
        VBox card = MapWorkspaceSupport.card(
                "Reiseansicht",
                new Label("Aktiver Dungeon: " + snapshot.mapName()),
                new Label("Ebene z=" + snapshot.currentFloor()),
                new Label("Overlay: " + state.overlaySettings().mode().label()),
                MapWorkspaceSupport.muted(selectedTarget == null
                        ? "Kein Raumfokus ausgewählt."
                        : "Fokus: " + selectedTarget.ownerKind() + " · " + selectedTarget.label()),
                MapWorkspaceSupport.muted("Travel-Actions und Party-Token bleiben angedockt, bis die Runtime-Domain sie liefert."));
        for (String message : state.lastMutationMessages()) {
            Label line = new Label(message);
            line.setWrapText(true);
            card.getChildren().add(line);
        }
        return card;
    }
    private VBox objectListCard(@Nullable DungeonLoadedMapViewModel snapshot) {
        if (snapshot == null || snapshot.selectableTargets().isEmpty()) {
            return MapWorkspaceSupport.card(
                    "Inspector",
                    MapWorkspaceSupport.muted("Keine selektierbaren Runtime-Objekte vorhanden."));
        }
        return MapWorkspaceSupport.card(
                "Inspector",
                objectList,
                MapWorkspaceSupport.muted("Details landen im Shell-Inspector."));
    }
    private void syncMapList() {
        var state = controller.viewState();
        withSelectionSync(() -> {
            mapList.getItems().setAll(state.visibleMaps());
            DungeonMapSummaryViewModel selected = state.selectedSummary();
            if (selected == null) {
                mapList.getSelectionModel().clearSelection();
            } else {
                mapList.getSelectionModel().select(selected);
            }
        });
    }
    private void syncObjectList(@Nullable DungeonLoadedMapViewModel snapshot) {
        withSelectionSync(() ->
                selectedTarget = DungeonMapSelectionSupport.syncSelectionList(objectList, snapshot, selectedTarget));
    }
    @SuppressWarnings("PMD.UnusedAssignment")
    private void withSelectionSync(Runnable action) {
        syncingSelection = true;
        try {
            action.run();
        } finally {
            syncingSelection = false;
        }
    }
}
