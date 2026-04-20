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
                () -> toRenderModel(viewModel.mapPresentationProperty().get()),
                viewModel.mapPresentationProperty()));
        state.stateTextProperty().bind(viewModel.stateProperty());
        controls.onRefresh(viewModel::refresh);
        viewModel.refresh();
        return new Binding(controls, main, state);
    }

    private DungeonMapMainView.RenderModel toRenderModel(DungeonTravelViewModel.MapPresentation presentation) {
        DungeonTravelViewModel.MapPresentation resolved = presentation == null
                ? DungeonTravelViewModel.MapPresentation.empty("Travel workspace")
                : presentation;
        return new DungeonMapMainView.RenderModel(
                resolved.title(),
                resolved.subtitle(),
                resolved.modeLabel(),
                resolved.statusLabel(),
                resolved.summaryLabel(),
                resolved.mapLoaded(),
                resolved.overlayMessage(),
                DungeonMapMainView.RenderTopology.valueOf(resolved.topology().name()),
                resolved.cells().stream()
                        .map(this::toRenderCell)
                        .toList(),
                resolved.edges().stream()
                        .map(this::toRenderEdge)
                        .toList());
    }

    private DungeonMapMainView.RenderCell toRenderCell(DungeonTravelViewModel.CellPresentation cell) {
        return new DungeonMapMainView.RenderCell(
                cell.q(),
                cell.r(),
                cell.label(),
                cell.room(),
                cell.corridor(),
                cell.blocked(),
                cell.interactive(),
                cell.current(),
                cell.ownerKind(),
                cell.ownerId(),
                cell.partKind());
    }

    private DungeonMapMainView.RenderEdge toRenderEdge(DungeonTravelViewModel.EdgePresentation edge) {
        return new DungeonMapMainView.RenderEdge(
                edge.fromQ(),
                edge.fromR(),
                edge.toQ(),
                edge.toR(),
                edge.kind(),
                edge.label(),
                edge.interactive(),
                edge.ownerKind(),
                edge.ownerId(),
                edge.partKind());
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
