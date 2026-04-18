package src.view.dungeoneditor.interactor;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ListView;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.mapcore.api.MapSelectionRef;
import src.view.dungeonshared.interactor.DungeonMapSelectionSupport;
import src.view.dungeonshared.interactor.DungeonMapSurfaceController;
import src.view.mapshared.interactor.MapWorkspaceSupport;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;

final class DungeonEditorStatePane {

    private final DungeonMapSurfaceController controller;
    private final Supplier<String> viewportSummarySupplier;
    private final Supplier<src.domain.dungeon.api.Viewport> viewportSupplier;
    private final VBox content = new VBox(12);
    private final Button deleteButton = new Button("Dungeon loeschen");
    private final ListView<MapSelectionRef> objectList = new ListView<>();
    private Consumer<MapSelectionRef> onTargetSelected = ignored -> { };
    private DungeonEditorTool activeTool = DungeonEditorTool.SELECT;
    private @Nullable MapSelectionRef selectedTarget;
    private boolean syncingSelection;

    DungeonEditorStatePane(
            DungeonMapSurfaceController controller,
            Supplier<String> viewportSummarySupplier,
            Supplier<src.domain.dungeon.api.Viewport> viewportSupplier
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.viewportSummarySupplier = Objects.requireNonNull(viewportSummarySupplier, "viewportSummarySupplier");
        this.viewportSupplier = Objects.requireNonNull(viewportSupplier, "viewportSupplier");
        content.getStyleClass().setAll("dungeon-editor-sidebar", "scene-pane");
        content.setPadding(new Insets(12));
        deleteButton.setMaxWidth(Double.MAX_VALUE);
        deleteButton.setOnAction(event -> controller.deleteLoaded());
        DungeonMapSelectionSupport.configureSelectionList(objectList, 180.0, () -> syncingSelection, () -> onTargetSelected);

        controller.addListener(this::refresh);
        refresh();
    }

    Node content() {
        return content;
    }

    void setActiveTool(DungeonEditorTool activeTool) {
        this.activeTool = activeTool == null ? DungeonEditorTool.SELECT : activeTool;
        refresh();
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
        syncObjectList(snapshot);
        deleteButton.setDisable(!state.hasLoadedMap());
        content.getChildren().setAll(
                loadedMapCard(snapshot),
                objectSelectionCard(snapshot),
                toolDockCard(),
                mutationFeedbackCard()
        );
    }

    private VBox loadedMapCard(@Nullable BaseMapSnapshot snapshot) {
        if (snapshot == null) {
            return MapWorkspaceSupport.card(
                    "Dungeon",
                    new Label("Kein Dungeon geladen"),
                    MapWorkspaceSupport.muted("Waehle oder erstelle einen Dungeon links im Cockpit."));
        }
        Label mapId = new Label("ID " + snapshot.mapId().value());
        Label revision = new Label("Revision " + snapshot.revision());
        Label floor = new Label("Ebene z=" + snapshot.currentFloor());
        Label viewport = new Label(viewportSummarySupplier.get());
        viewport.setWrapText(true);
        return MapWorkspaceSupport.card(
                "Dungeon",
                mapId,
                revision,
                floor,
                MapWorkspaceSupport.muted("Viewport"),
                viewport,
                deleteButton);
    }

    private VBox objectSelectionCard(@Nullable BaseMapSnapshot snapshot) {
        Label hint = selectedTarget == null
                ? MapWorkspaceSupport.muted("Wähle Zellen im Workspace oder Einträge aus der Liste.")
                : MapWorkspaceSupport.muted("Aktiv: " + selectedTarget.ownerKind() + " · " + selectedTarget.label());
        if (snapshot == null || snapshot.selectableTargets().isEmpty()) {
            return MapWorkspaceSupport.card(
                    "Auswahl",
                    MapWorkspaceSupport.muted("Noch keine selektierbaren Objekte auf der aktiven Ebene."));
        }
        return MapWorkspaceSupport.card("Auswahl", objectList, hint);
    }

    private VBox toolDockCard() {
        return DungeonEditorStateSupport.toolDockCard(activeTool, controller, selectedTarget, viewportSupplier);
    }

    private VBox mutationFeedbackCard() {
        return DungeonEditorStateSupport.mutationFeedbackCard(controller);
    }

    private void syncObjectList(@Nullable BaseMapSnapshot snapshot) {
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
