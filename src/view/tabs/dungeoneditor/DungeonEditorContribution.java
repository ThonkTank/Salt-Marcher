package src.view.tabs.dungeoneditor;

import java.util.Map;
import java.util.Objects;
import javafx.beans.binding.Bindings;
import javafx.scene.Node;
import shell.api.ContributionKey;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import shell.api.ShellTabMode;
import shell.api.ShellTabSpec;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.mapcore.published.MapCellRef;
import src.domain.mapcore.published.MapCellSnapshot;
import src.domain.mapcore.published.MapCellStyle;
import src.domain.mapcore.published.MapEdgeRef;
import src.domain.mapcore.published.MapEdgeSnapshot;
import src.domain.mapcore.published.MapSelectionRef;
import src.domain.mapcore.published.MapSurfaceSnapshot;
import src.domain.mapcore.published.MapTopologyKind;
import src.view.views.DungeonMapMainView;

public final class DungeonEditorContribution implements ShellContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public DungeonEditorContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("dungeon-editor"),
                new NavigationGroupSpec("world", "World", 20),
                10,
                true,
                null,
                ShellTabMode.EDITOR);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        DungeonApplicationService dungeon = Objects.requireNonNull(runtimeContext, "runtimeContext")
                .services()
                .require(DungeonApplicationService.class);
        DungeonEditorViewModel viewModel = new DungeonEditorViewModel(dungeon);
        DungeonEditorControlsView controls = new DungeonEditorControlsView();
        DungeonEditorMainView main = new DungeonEditorMainView();
        DungeonEditorStateView state = new DungeonEditorStateView();
        main.renderModelProperty().bind(Bindings.createObjectBinding(
                () -> toRenderModel(viewModel.snapshotProperty().get()),
                viewModel.snapshotProperty()));
        state.stateTextProperty().bind(viewModel.stateProperty());
        controls.onCreateMap(viewModel::refresh);
        viewModel.refresh();
        return new Binding(controls, main, state);
    }

    private DungeonMapMainView.RenderModel toRenderModel(DungeonSnapshot snapshot) {
        if (snapshot == null) {
            return emptyRenderModel();
        }
        MapSurfaceSnapshot surface = snapshot.surface();
        java.util.List<DungeonMapMainView.RenderCell> cells = surface.allCells().stream()
                .map(this::toRenderCell)
                .toList();
        java.util.List<DungeonMapMainView.RenderEdge> edges = surface.edges().stream()
                .filter(this::hasCompleteEdgeRef)
                .map(this::toRenderEdge)
                .toList();
        boolean mapLoaded = !cells.isEmpty();
        return new DungeonMapMainView.RenderModel(
                snapshot.mapName(),
                surface.width() + " x " + surface.height() + " squares",
                snapshot.mode().name(),
                "Revision " + snapshot.revision(),
                cells.size() + " cells, " + edges.size() + " edges",
                mapLoaded,
                mapLoaded ? "" : "No dungeon map geometry available.",
                topology(surface.topology()),
                cells,
                edges);
    }

    private DungeonMapMainView.RenderModel emptyRenderModel() {
        return new DungeonMapMainView.RenderModel(
                "Dungeon workspace",
                "",
                "",
                "",
                "",
                false,
                "No dungeon map loaded.",
                DungeonMapMainView.RenderTopology.SQUARE,
                java.util.List.of(),
                java.util.List.of());
    }

    private DungeonMapMainView.RenderCell toRenderCell(MapCellSnapshot cell) {
        MapCellRef ref = cell.ref();
        MapCellStyle style = cell.style() == null
                ? new MapCellStyle(false, false, false, false, false)
                : cell.style();
        MapSelectionRef selection = cell.selectionRef();
        return new DungeonMapMainView.RenderCell(
                ref.q(),
                ref.r(),
                cell.label(),
                style.room(),
                style.corridor(),
                style.blocked(),
                style.interactive(),
                style.current(),
                selection == null ? "" : selection.ownerKind(),
                selection == null ? 0L : selection.ownerId(),
                selection == null ? "" : selection.partKind());
    }

    private DungeonMapMainView.RenderEdge toRenderEdge(MapEdgeSnapshot edge) {
        MapEdgeRef ref = edge.ref();
        MapSelectionRef selection = edge.selectionRef();
        return new DungeonMapMainView.RenderEdge(
                ref.from().q(),
                ref.from().r(),
                ref.to().q(),
                ref.to().r(),
                edge.kind(),
                edge.label(),
                selection != null,
                selection == null ? "" : selection.ownerKind(),
                selection == null ? 0L : selection.ownerId(),
                selection == null ? "" : selection.partKind());
    }

    private boolean hasCompleteEdgeRef(MapEdgeSnapshot edge) {
        return edge.ref() != null && edge.ref().from() != null && edge.ref().to() != null;
    }

    private DungeonMapMainView.RenderTopology topology(MapTopologyKind topology) {
        return topology == MapTopologyKind.HEX
                ? DungeonMapMainView.RenderTopology.HEX
                : DungeonMapMainView.RenderTopology.SQUARE;
    }

    private record Binding(
            Node controls,
            Node main,
            Node state
    ) implements ShellBinding {

        @Override
        public String title() {
            return "Dungeon Editor";
        }

        @Override
        public String navigationLabel() {
            return "Dungeon";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(
                    ShellSlot.COCKPIT_CONTROLS, controls,
                    ShellSlot.COCKPIT_MAIN, main,
                    ShellSlot.COCKPIT_STATE, state);
        }
    }
}
