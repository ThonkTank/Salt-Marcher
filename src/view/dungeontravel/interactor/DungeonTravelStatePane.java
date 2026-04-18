package src.view.dungeontravel.interactor;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.dungeon.api.DungeonMapSummary;
import src.domain.mapcore.api.MapSelectionRef;
import src.view.dungeonshared.interactor.DungeonMapSelectionSupport;
import src.view.dungeonshared.interactor.DungeonMapSurfaceController;
import src.view.mapshared.interactor.MapWorkspaceSupport;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;

final class DungeonTravelStatePane {

    private final DungeonMapSurfaceController controller;
    private final Supplier<src.domain.dungeon.api.Viewport> viewportSupplier;
    private final VBox content = new VBox(12);
    private final TextField searchField = new TextField();
    private final ListView<DungeonMapSummary> mapList = new ListView<>();
    private final TextField createNameField = new TextField();
    private final Button loadButton = new Button("Dungeon laden");
    private final Button createButton = new Button("Dungeon anlegen");
    private final Button deleteButton = new Button("Dungeon loeschen");
    private final ListView<MapSelectionRef> objectList = new ListView<>();
    private Consumer<MapSelectionRef> onTargetSelected = ignored -> { };
    private @Nullable MapSelectionRef selectedTarget;
    private boolean syncingSelection;

    DungeonTravelStatePane(
            DungeonMapSurfaceController controller,
            Supplier<src.domain.dungeon.api.Viewport> viewportSupplier
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.viewportSupplier = Objects.requireNonNull(viewportSupplier, "viewportSupplier");
        content.getStyleClass().setAll("dungeon-editor-sidebar", "scene-pane");
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
            protected void updateItem(DungeonMapSummary item, boolean empty) {
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

    Node content() {
        return content;
    }

    void setOnTargetSelected(Consumer<MapSelectionRef> onTargetSelected) {
        this.onTargetSelected = onTargetSelected == null ? ignored -> { } : onTargetSelected;
    }

    void showSelectedTarget(@Nullable MapSelectionRef selectedTarget) {
        this.selectedTarget = selectedTarget;
        refresh();
    }

    void refresh() {
        var state = controller.state();
        BaseMapSnapshot snapshot = state.loadedSnapshot();
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

    private VBox runtimeStateCard(@Nullable BaseMapSnapshot snapshot) {
        if (snapshot == null) {
            return MapWorkspaceSupport.card(
                "Reiseansicht",
                MapWorkspaceSupport.muted("Lade einen Dungeon, um Runtime-Fokus und Overlay-Ebenen zu sehen."));
        }
        var state = controller.state();
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

    private VBox objectListCard(@Nullable BaseMapSnapshot snapshot) {
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
        syncingSelection = true;
        var state = controller.state();
        mapList.getItems().setAll(state.visibleMaps());
        DungeonMapSummary selected = state.selectedSummary();
        if (selected == null) {
            mapList.getSelectionModel().clearSelection();
        } else {
            mapList.getSelectionModel().select(selected);
        }
        syncingSelection = false;
    }

    private void syncObjectList(@Nullable BaseMapSnapshot snapshot) {
        syncingSelection = true;
        selectedTarget = DungeonMapSelectionSupport.syncSelectionList(objectList, snapshot, selectedTarget);
        syncingSelection = false;
    }
}
