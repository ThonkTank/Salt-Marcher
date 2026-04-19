package src.view.dungeonmap.View;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ListView;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import src.view.dungeonmap.api.DungeonEditorTool;
import src.view.dungeonmap.api.DungeonLoadedMapViewModel;
import src.view.dungeonmap.api.DungeonMapSurfaceViewModel;
import src.view.dungeonmap.api.DungeonSelectionItemViewModel;
import src.view.dungeonmap.api.DungeonViewportViewModel;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;
public final class DungeonEditorStatePane {
    private final DungeonMapSurfaceViewModel controller;
    private final Supplier<String> viewportSummarySupplier;
    private final Supplier<DungeonViewportViewModel> viewportSupplier;
    private final VBox content = new VBox(12);
    private final Button deleteButton = new Button("Dungeon loeschen");
    private final ListView<DungeonSelectionItemViewModel> objectList = new ListView<>();
    private Consumer<DungeonSelectionItemViewModel> onTargetSelected = ignored -> { };
    private DungeonEditorTool activeTool = DungeonEditorTool.defaultTool();
    private @Nullable DungeonSelectionItemViewModel selectedTarget;
    private boolean syncingSelection;
    public DungeonEditorStatePane(
            DungeonMapSurfaceViewModel controller,
            Supplier<String> viewportSummarySupplier,
            Supplier<DungeonViewportViewModel> viewportSupplier
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.viewportSummarySupplier = Objects.requireNonNull(viewportSummarySupplier, "viewportSummarySupplier");
        this.viewportSupplier = Objects.requireNonNull(viewportSupplier, "viewportSupplier");
        content.getStyleClass().setAll("control-stack", "surface-root");
        content.setPadding(new Insets(12));
        deleteButton.setMaxWidth(Double.MAX_VALUE);
        deleteButton.setOnAction(event -> controller.deleteLoaded());
        DungeonMapSelectionSupport.configureSelectionList(objectList, 180.0, () -> syncingSelection, () -> onTargetSelected);
        controller.addListener(this::refresh);
        refresh();
    }
    public Node content() {
        return content;
    }
    public void setActiveTool(DungeonEditorTool activeTool) {
        this.activeTool = activeTool == null ? DungeonEditorTool.defaultTool() : activeTool;
        refresh();
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
        syncObjectList(snapshot);
        deleteButton.setDisable(!state.hasLoadedMap());
        content.getChildren().setAll(
                loadedMapCard(snapshot),
                objectSelectionCard(snapshot),
                toolDockCard(),
                mutationFeedbackCard()
        );
    }
    private VBox loadedMapCard(@Nullable DungeonLoadedMapViewModel snapshot) {
        if (snapshot == null) {
            return MapWorkspaceSupport.card(
                    "Dungeon",
                    new Label("Kein Dungeon geladen"),
                    MapWorkspaceSupport.muted("Waehle oder erstelle einen Dungeon links im Cockpit."));
        }
        Label mapId = new Label("ID " + snapshot.mapId());
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
    private VBox objectSelectionCard(@Nullable DungeonLoadedMapViewModel snapshot) {
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
