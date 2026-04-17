package src.view.dungeoneditor.interactor;

import javafx.geometry.Insets;
import javafx.scene.control.Separator;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import shell.host.InspectorEntrySpec;
import shell.host.InspectorSink;
import src.domain.dungeon.api.DungeonEditorOperation;
import src.domain.dungeon.api.DungeonOperationResult;
import src.domain.dungeon.api.DungeonSnapshot;
import src.domain.dungeon.dungeonAPI;
import src.domain.mapcore.api.MapCellRef;
import src.domain.mapcore.api.MapTopologyKind;
import src.view.mapshared.Model.MapCellViewModel;
import src.view.mapshared.Model.MapWorkspaceRenderModel;
import src.view.mapshared.Model.MapWorkspaceTopology;
import src.view.mapshared.interactor.MapWorkspaceSupport;
import src.view.mapshared.View.MapWorkspaceView;

import java.util.List;

/**
 * Editor-only coordination around the shared workspace and dungeon API.
 */
public final class DungeonEditorInteractor {

    private final dungeonAPI dungeon;
    private final MapWorkspaceView workspaceView;
    private final DungeonEditorInspectorSupport inspectorSupport;
    private final VBox controls = new VBox(8);
    private final VBox state = new VBox(8);

    private DungeonSnapshot snapshot;

    public DungeonEditorInteractor(InspectorSink inspector) {
        this.dungeon = new dungeonAPI();
        this.workspaceView = new MapWorkspaceView();
        this.inspectorSupport = new DungeonEditorInspectorSupport(dungeon, inspector);
        this.workspaceView.setCellSelectionListener(cell -> inspectorSupport.showSelection(snapshot.surface(), cell));
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
        controls.getStyleClass().addAll("dungeon-editor-toolbar", "dungeon-editor-sidebar");
        controls.setPadding(new Insets(12));
        controls.setFillWidth(true);
        VBox identityCard = MapWorkspaceSupport.card(
                "Dungeon",
                new Label("Committed editor workspace"),
                MapWorkspaceSupport.muted("Room and corridor anchors update the shared snapshot."));
        Button west = moveButton("Room west", -1, 0);
        Button east = moveButton("Room east", 1, 0);
        Button north = moveButton("Room north", 0, -1);
        Button south = moveButton("Room south", 0, 1);
        Button reset = new Button("Reset demo");
        reset.setMaxWidth(Double.MAX_VALUE);
        reset.setOnAction(event -> applyOperation(new DungeonEditorOperation.ResetDemoLayout()));
        VBox toolCard = MapWorkspaceSupport.card("Anchor Shift", west, east, north, south, new Separator(), reset);
        controls.getChildren().setAll(identityCard, toolCard);
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

    private MapWorkspaceRenderModel toRenderModel(DungeonSnapshot source, String subtitle, @Nullable MapCellRef activeCell) {
        long roomCount = source.surface().allCells().stream().filter(cell -> cell.style().room()).count();
        long corridorCount = source.surface().allCells().stream().filter(cell -> cell.style().corridor()).count();
        return new MapWorkspaceRenderModel(
                source.mapName(),
                subtitle,
                source.surface().topology() == MapTopologyKind.HEX ? MapWorkspaceTopology.HEX : MapWorkspaceTopology.SQUARE,
                source.surface().width(),
                source.surface().height(),
                source.surface().allCells().stream().map(cell -> MapWorkspaceSupport.toViewCell(cell, activeCell)).toList(),
                source.surface().edges().stream().map(MapWorkspaceSupport::toViewEdge).toList(),
                "EDITOR",
                "Revision " + source.revision(),
                roomCount + " room cells  |  " + corridorCount + " corridor cells  |  " + source.surface().edges().size() + " boundary overlays"
        );
    }

    private void refreshState(List<String> messages) {
        state.getStyleClass().addAll("dungeon-editor-sidebar", "scene-pane");
        state.setPadding(new Insets(12));
        Label revision = new Label("Revision: " + snapshot.revision());
        Label aggregates = new Label(String.join(", ", snapshot.aggregateSummaries()));
        aggregates.setWrapText(true);
        Label relations = new Label(String.join(", ", snapshot.relationSummaries()));
        relations.setWrapText(true);
        VBox overviewCard = MapWorkspaceSupport.card(
                "Snapshot",
                revision,
                MapWorkspaceSupport.muted("Aggregates"),
                aggregates,
                MapWorkspaceSupport.muted("Relations"),
                relations);
        VBox messagesCard = MapWorkspaceSupport.card("Reactions");
        for (String message : messages) {
            Label line = new Label(message);
            line.setWrapText(true);
            messagesCard.getChildren().add(line);
        }
        state.getChildren().setAll(overviewCard, messagesCard);
    }
}
