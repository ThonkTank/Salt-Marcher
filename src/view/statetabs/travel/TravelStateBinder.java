package src.view.statetabs.travel;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;

final class TravelStateBinder {

    TravelStateBinder(ShellRuntimeContext runtimeContext) {
        Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        TravelStateViewModel viewModel = new TravelStateViewModel();
        TravelStateView state = new TravelStateView();
        state.iconTextProperty().bind(viewModel.iconTextProperty());
        state.locationTextProperty().bind(viewModel.locationTextProperty());
        state.statusTextProperty().bind(viewModel.statusTextProperty());
        state.contextTextProperty().bind(viewModel.contextTextProperty());
        state.detailKeyOneTextProperty().bind(viewModel.detailKeyOneTextProperty());
        state.detailValueOneTextProperty().bind(viewModel.detailValueOneTextProperty());
        state.detailKeyTwoTextProperty().bind(viewModel.detailKeyTwoTextProperty());
        state.detailValueTwoTextProperty().bind(viewModel.detailValueTwoTextProperty());
        state.detailKeyThreeTextProperty().bind(viewModel.detailKeyThreeTextProperty());
        state.detailValueThreeTextProperty().bind(viewModel.detailValueThreeTextProperty());
        state.sectionHeaderTextProperty().bind(viewModel.sectionHeaderTextProperty());
        state.sectionValueTextProperty().bind(viewModel.sectionValueTextProperty());
        return new Binding(state);
    }

    private record Binding(Node state) implements ShellBinding {

        @Override
        public String title() {
            return "Reise";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(ShellSlot.COCKPIT_STATE, state);
        }
    }
}
