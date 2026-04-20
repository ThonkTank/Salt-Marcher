package src.view.tabs.dungeontravel;

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

public final class DungeonTravelContribution implements ShellContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public DungeonTravelContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("dungeon-travel"),
                new NavigationGroupSpec("world", "World", 20),
                20,
                false,
                null,
                ShellTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        DungeonApplicationService dungeon = Objects.requireNonNull(runtimeContext, "runtimeContext")
                .services()
                .require(DungeonApplicationService.class);
        DungeonTravelViewModel viewModel = new DungeonTravelViewModel(dungeon);
        DungeonTravelControlsView controls = new DungeonTravelControlsView();
        DungeonTravelMainView main = new DungeonTravelMainView();
        DungeonTravelStateView state = new DungeonTravelStateView();
        main.renderModelProperty().bind(Bindings.createObjectBinding(
                () -> mapSnapshotToRenderModel(viewModel.snapshotProperty().get()),
                viewModel.snapshotProperty()));
        state.stateTextProperty().bind(viewModel.stateProperty());
        controls.onRefresh(viewModel::refresh);
        viewModel.refresh();
        return new Binding(controls, main, state);
    }

    private DungeonMapMainView.RenderModel mapSnapshotToRenderModel(DungeonSnapshot snapshot) {
        if (snapshot == null) {
            return travelPlaceholder();
        }
        MapSurfaceSnapshot surface = snapshot.surface();
        java.util.List<DungeonMapMainView.RenderCell> renderedCells = surface.allCells().stream()
                .map(this::mapCell)
                .toList();
        java.util.List<DungeonMapMainView.RenderEdge> renderedEdges = surface.edges().stream()
                .filter(this::edgeHasCoordinates)
                .map(this::mapEdge)
                .toList();
        String loadMessage = renderedCells.isEmpty() ? "No dungeon map geometry available." : "";
        return new DungeonMapMainView.RenderModel(
                snapshot.mapName(),
                surface.width() + " x " + surface.height() + " squares",
                snapshot.mode().name(),
                "Revision " + snapshot.revision(),
                renderedCells.size() + " cells, " + renderedEdges.size() + " edges",
                !renderedCells.isEmpty(),
                loadMessage,
                resolveTopology(surface.topology()),
                renderedCells,
                renderedEdges);
    }

    private DungeonMapMainView.RenderModel travelPlaceholder() {
        return new DungeonMapMainView.RenderModel(
                "Travel workspace",
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

    private DungeonMapMainView.RenderCell mapCell(MapCellSnapshot cell) {
        MapCellRef ref = cell.ref();
        MapCellStyle resolvedStyle = cell.style() == null
                ? new MapCellStyle(false, false, false, false, false)
                : cell.style();
        MapSelectionRef selected = cell.selectionRef();
        return new DungeonMapMainView.RenderCell(
                ref.q(),
                ref.r(),
                cell.label(),
                resolvedStyle.room(),
                resolvedStyle.corridor(),
                resolvedStyle.blocked(),
                resolvedStyle.interactive(),
                resolvedStyle.current(),
                selected == null ? "" : selected.ownerKind(),
                selected == null ? 0L : selected.ownerId(),
                selected == null ? "" : selected.partKind());
    }

    private DungeonMapMainView.RenderEdge mapEdge(MapEdgeSnapshot edge) {
        MapEdgeRef edgeRef = edge.ref();
        MapSelectionRef selected = edge.selectionRef();
        return new DungeonMapMainView.RenderEdge(
                edgeRef.from().q(),
                edgeRef.from().r(),
                edgeRef.to().q(),
                edgeRef.to().r(),
                edge.kind(),
                edge.label(),
                selected != null,
                selected == null ? "" : selected.ownerKind(),
                selected == null ? 0L : selected.ownerId(),
                selected == null ? "" : selected.partKind());
    }

    private boolean edgeHasCoordinates(MapEdgeSnapshot edge) {
        return edge.ref() != null && edge.ref().from() != null && edge.ref().to() != null;
    }

    private DungeonMapMainView.RenderTopology resolveTopology(MapTopologyKind topology) {
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
            return "Dungeon Travel";
        }

        @Override
        public String navigationLabel() {
            return "Travel";
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
