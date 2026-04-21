package src.view.dropdowns.adventuringday;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.party.PartyApplicationService;

final class AdventuringDayTopBarBinder {

    private final ShellRuntimeContext runtimeContext;

    AdventuringDayTopBarBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        PartyApplicationService party = runtimeContext.services().require(PartyApplicationService.class);
        AdventuringDayTopBarViewModel viewModel = new AdventuringDayTopBarViewModel(party);
        AdventuringDayTopBarView view = new AdventuringDayTopBarView();
        view.triggerTextProperty().bind(viewModel.triggerTextProperty());
        view.setCalculationProvider(viewModel::calculate);
        view.showPanel(toPanelContent(viewModel.panelProperty().get()));
        viewModel.panelProperty().addListener((ignored, before, after) -> view.showPanel(toPanelContent(after)));
        view.onOpen(viewModel::refresh);
        viewModel.refresh();
        return new Binding(view);
    }

    private static AdventuringDayTopBarView.PanelContent toPanelContent(AdventuringDayTopBarViewModel.PanelModel model) {
        AdventuringDayTopBarViewModel.PanelModel safeModel = model == null
                ? AdventuringDayTopBarViewModel.PanelModel.loadingModel()
                : model;
        return new AdventuringDayTopBarView.PanelContent(
                safeModel.loading(),
                safeModel.error(),
                safeModel.empty(),
                safeModel.activePartyLevels());
    }

    private record Binding(Node topBar) implements ShellBinding {

        @Override
        public String title() {
            return "Adventuring Day";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(ShellSlot.TOP_BAR, topBar);
        }
    }
}
