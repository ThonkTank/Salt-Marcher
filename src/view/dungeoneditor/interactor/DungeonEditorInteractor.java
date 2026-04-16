package src.view.dungeoneditor.interactor;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import shell.host.InspectorEntrySpec;
import shell.host.InspectorSink;
import src.domain.dungeon.api.DungeonEditorOperation;
import src.domain.dungeon.api.DungeonOperationResult;
import src.domain.dungeon.api.DungeonSnapshot;
import src.domain.dungeon.dungeonAPI;
import src.domain.mapcore.api.MapCellRef;
import src.domain.mapcore.api.MapCellSnapshot;
import src.domain.mapcore.api.MapSelectionRef;
import src.domain.mapcore.api.MapSurfaceSnapshot;
import src.domain.mapcore.api.MapTopologyKind;
import src.view.mapshared.Model.MapCellViewModel;
import src.view.mapshared.Model.MapWorkspaceRenderModel;
import src.view.mapshared.Model.MapWorkspaceTopology;
import src.view.mapshared.View.MapWorkspaceView;

import java.util.List;

/**
 * Editor-only coordination around the shared workspace and dungeon API.
 */
public final class DungeonEditorInteractor {

    private final dungeonAPI dungeon;
    private final InspectorSink inspector;
    private final MapWorkspaceView workspaceView;
    private final VBox controls = new VBox(8);
    private final VBox state = new VBox(8);

    private DungeonSnapshot snapshot;

    public DungeonEditorInteractor(InspectorSink inspector) {
        this.dungeon = new dungeonAPI();
        this.inspector = inspector;
        this.workspaceView = new MapWorkspaceView();
        this.workspaceView.setCellSelectionListener(this::showCellInspector);
        buildControls();
        reload();
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
        controls.setPadding(new Insets(8));
        Label title = new Label("Dungeon Editor");
        title.getStyleClass().add("bold");

        Button west = moveButton("Room west", -1, 0);
        Button east = moveButton("Room east", 1, 0);
        Button north = moveButton("Room north", 0, -1);
        Button south = moveButton("Room south", 0, 1);
        Button reset = new Button("Reset demo");
        reset.setMaxWidth(Double.MAX_VALUE);
        reset.setOnAction(event -> applyOperation(new DungeonEditorOperation.ResetDemoLayout()));

        controls.getChildren().setAll(title, west, east, north, south, reset);
    }

    private Button moveButton(String label, int dq, int dr) {
        Button button = new Button(label);
        button.setMaxWidth(Double.MAX_VALUE);
        button.setOnAction(event -> applyOperation(new DungeonEditorOperation.MoveRoomAnchor(dq, dr)));
        return button;
    }

    private void reload() {
        snapshot = dungeon.loadSnapshot();
        workspaceView.show(toRenderModel(snapshot, "Editor view over committed dungeon snapshot", null));
        refreshState(List.of("revision " + snapshot.revision()));
    }

    private void applyOperation(DungeonEditorOperation operation) {
        DungeonOperationResult result = dungeon.applyOperation(operation);
        snapshot = result.snapshot();
        workspaceView.show(toRenderModel(snapshot, "Editor view over committed dungeon snapshot", null));
        refreshState(result.reactionMessages());
    }

    private void showCellInspector(MapCellViewModel cellViewModel) {
        MapSelectionRef selectionRef = resolveSelection(snapshot.surface(), cellViewModel);
        if (selectionRef == null) {
            inspector.clear();
            return;
        }
        inspector.push(new InspectorEntrySpec(
                selectionRef.label(),
                selectionRef.ownerKind() + ":" + selectionRef.ownerId(),
                () -> inspectorContent(selectionRef),
                null
        ));
    }

    private Node inspectorContent(MapSelectionRef selectionRef) {
        var details = dungeon.describeSelection(selectionRef.ownerKind(), selectionRef.ownerId());
        VBox box = new VBox(6);
        box.setPadding(new Insets(12));
        Label title = new Label(details.title());
        title.getStyleClass().add("bold");
        Label summary = new Label(details.summary());
        summary.setWrapText(true);
        box.getChildren().addAll(title, summary);
        for (String fact : details.facts()) {
            Label line = new Label(fact);
            line.setWrapText(true);
            box.getChildren().add(line);
        }
        return box;
    }

    private MapSelectionRef resolveSelection(MapSurfaceSnapshot surface, MapCellViewModel cellViewModel) {
        if (surface.selectableTargets().isEmpty()) {
            return null;
        }
        if (cellViewModel.r() >= 2 && cellViewModel.r() <= 3) {
            return surface.selectableTargets().stream()
                    .filter(target -> "room".equals(target.ownerKind()))
                    .findFirst()
                    .orElse(null);
        }
        if (cellViewModel.r() >= 4) {
            return surface.selectableTargets().stream()
                    .filter(target -> "corridor".equals(target.ownerKind()))
                    .findFirst()
                    .orElse(null);
        }
        return surface.selectableTargets().stream()
                .filter(target -> "door".equals(target.ownerKind()))
                .findFirst()
                .orElse(null);
    }

    private MapWorkspaceRenderModel toRenderModel(DungeonSnapshot source, String subtitle, MapCellRef activeCell) {
        return new MapWorkspaceRenderModel(
                source.mapName(),
                subtitle,
                source.surface().topology() == MapTopologyKind.HEX ? MapWorkspaceTopology.HEX : MapWorkspaceTopology.SQUARE,
                source.surface().width(),
                source.surface().height(),
                source.surface().allCells().stream().map(cell -> toViewCell(cell, activeCell)).toList()
        );
    }

    private MapCellViewModel toViewCell(MapCellSnapshot cell, MapCellRef activeCell) {
        boolean current = activeCell != null && activeCell.equals(cell.ref());
        return new MapCellViewModel(
                cell.ref().q(),
                cell.ref().r(),
                cell.label(),
                cell.style().room(),
                cell.style().corridor(),
                cell.style().blocked(),
                cell.style().interactive(),
                current || cell.style().current()
        );
    }

    private void refreshState(List<String> messages) {
        state.setPadding(new Insets(8));
        Label title = new Label("Editor State");
        title.getStyleClass().add("bold");
        Label revision = new Label("Revision: " + snapshot.revision());
        Label aggregates = new Label("Aggregates: " + String.join(", ", snapshot.aggregateSummaries()));
        aggregates.setWrapText(true);
        Label relations = new Label("Relations: " + String.join(", ", snapshot.relationSummaries()));
        relations.setWrapText(true);
        state.getChildren().setAll(title, revision, aggregates, relations);
        for (String message : messages) {
            Label line = new Label(message);
            line.setWrapText(true);
            state.getChildren().add(line);
        }
    }
}
