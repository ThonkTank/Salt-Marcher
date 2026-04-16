package src.view.dungeontravel.interactor;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import shell.host.InspectorEntrySpec;
import shell.host.InspectorSink;
import src.domain.dungeon.api.DungeonMapMode;
import src.domain.dungeon.api.DungeonSnapshot;
import src.domain.dungeon.dungeonAPI;
import src.domain.mapcore.api.MapCellRef;
import src.domain.mapcore.api.MapCellSnapshot;
import src.domain.mapcore.api.MapEdgeSnapshot;
import src.domain.mapcore.api.MapTopologyKind;
import src.view.mapshared.Model.MapCellViewModel;
import src.view.mapshared.Model.MapEdgeViewModel;
import src.view.mapshared.Model.MapWorkspaceRenderModel;
import src.view.mapshared.Model.MapWorkspaceTopology;
import src.view.mapshared.View.MapWorkspaceView;

import java.util.Comparator;

/**
 * Travel/runtime coordination over the same committed dungeon snapshot.
 */
public final class DungeonTravelInteractor {

    private final dungeonAPI dungeon;
    private final InspectorSink inspector;
    private final MapWorkspaceView workspaceView;
    private final VBox controls = new VBox(8);
    private final VBox state = new VBox(8);

    private DungeonSnapshot snapshot;
    private MapCellRef activeCell;

    public DungeonTravelInteractor(InspectorSink inspector) {
        this.dungeon = new dungeonAPI();
        this.inspector = inspector;
        this.workspaceView = new MapWorkspaceView();
        this.workspaceView.setCellSelectionListener(this::selectCell);
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
        Button snap = new Button("Focus entry");
        snap.setMaxWidth(Double.MAX_VALUE);
        snap.setOnAction(event -> {
            activeCell = firstTraversableCell();
            redraw();
        });
        controls.getChildren().setAll(
                card("Travel", new Label("Runtime projection over the committed dungeon."), muted("Shared dungeon presentation with active party focus.")),
                card("Actions", snap)
        );
    }

    private void reload() {
        snapshot = dungeon.loadSnapshot().withMode(DungeonMapMode.TRAVEL);
        activeCell = firstTraversableCell();
        redraw();
    }

    private MapCellRef firstTraversableCell() {
        return snapshot.surface().allCells().stream()
                .map(MapCellSnapshot::ref)
                .sorted(Comparator.comparingInt(MapCellRef::r).thenComparingInt(MapCellRef::q))
                .findFirst()
                .orElse(null);
    }

    private void selectCell(MapCellViewModel cellViewModel) {
        activeCell = new MapCellRef(cellViewModel.q(), cellViewModel.r(), 0);
        redraw();
        inspector.push(new InspectorEntrySpec(
                "Travel Position",
                "travel:" + cellViewModel.q() + ":" + cellViewModel.r(),
                () -> {
                    VBox box = new VBox(6);
                    box.setPadding(new Insets(12));
                    box.getChildren().addAll(
                            new Label("Active travel cell"),
                            new Label("q=" + cellViewModel.q()),
                            new Label("r=" + cellViewModel.r()),
                            new Label("level=0")
                    );
                    return box;
                },
                null
        ));
    }

    private void redraw() {
        workspaceView.show(new MapWorkspaceRenderModel(
                snapshot.mapName(),
                "Travel view reusing the committed dungeon snapshot",
                snapshot.surface().topology() == MapTopologyKind.HEX ? MapWorkspaceTopology.HEX : MapWorkspaceTopology.SQUARE,
                snapshot.surface().width(),
                snapshot.surface().height(),
                snapshot.surface().allCells().stream().map(this::toViewCell).toList(),
                snapshot.surface().edges().stream().map(this::toViewEdge).toList(),
                "TRAVEL",
                snapshot.mode().name(),
                activeCell == null
                        ? "No active travel cell"
                        : "Party focus q=" + activeCell.q() + " r=" + activeCell.r() + "  |  " + snapshot.surface().edges().size() + " boundary overlays"
        ));
        refreshState();
    }

    private MapCellViewModel toViewCell(MapCellSnapshot cell) {
        boolean current = activeCell != null && activeCell.equals(cell.ref());
        return new MapCellViewModel(
                cell.ref().q(),
                cell.ref().r(),
                cell.label(),
                cell.style().room(),
                cell.style().corridor(),
                cell.style().blocked(),
                cell.style().interactive(),
                current || cell.style().current(),
                cell.selectionRef() == null ? "" : cell.selectionRef().ownerKind(),
                cell.selectionRef() == null ? -1L : cell.selectionRef().ownerId(),
                cell.selectionRef() == null ? "" : cell.selectionRef().partKind()
        );
    }

    private MapEdgeViewModel toViewEdge(MapEdgeSnapshot edge) {
        return new MapEdgeViewModel(
                edge.ref().from().q(),
                edge.ref().from().r(),
                edge.ref().to().q(),
                edge.ref().to().r(),
                edge.kind(),
                edge.label(),
                edge.selectionRef() != null,
                edge.selectionRef() == null ? "" : edge.selectionRef().ownerKind(),
                edge.selectionRef() == null ? -1L : edge.selectionRef().ownerId(),
                edge.selectionRef() == null ? "" : edge.selectionRef().partKind()
        );
    }

    private void refreshState() {
        state.getStyleClass().addAll("dungeon-editor-sidebar", "scene-pane");
        state.setPadding(new Insets(12));
        Label revision = new Label("Revision: " + snapshot.revision());
        Label position = new Label(activeCell == null ? "Position: none" : "Position: " + activeCell.q() + "," + activeCell.r());
        Label mode = new Label("Mode: " + snapshot.mode());
        Label legend = new Label("Legend: room, corridor, active party marker, door overlays");
        legend.setWrapText(true);
        state.getChildren().setAll(card("Runtime State", revision, mode, position), card("Legend", legend));
    }

    private VBox card(String title, Node... content) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("editor-panel-title");
        VBox box = new VBox(6);
        box.getStyleClass().add("editor-card");
        box.getChildren().add(titleLabel);
        box.getChildren().addAll(content);
        return box;
    }

    private Label muted(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-muted");
        return label;
    }
}
