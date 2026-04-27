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
        TravelStatePresentationModel presentationModel = new TravelStatePresentationModel();
        TravelStateView state = new TravelStateView();
        state.iconTextProperty().bind(presentationModel.iconTextProperty());
        state.locationTextProperty().bind(presentationModel.locationTextProperty());
        state.statusTextProperty().bind(presentationModel.statusTextProperty());
        state.contextTextProperty().bind(presentationModel.contextTextProperty());
        state.detailKeyOneTextProperty().bind(presentationModel.detailKeyOneTextProperty());
        state.detailValueOneTextProperty().bind(presentationModel.detailValueOneTextProperty());
        state.detailKeyTwoTextProperty().bind(presentationModel.detailKeyTwoTextProperty());
        state.detailValueTwoTextProperty().bind(presentationModel.detailValueTwoTextProperty());
        state.detailKeyThreeTextProperty().bind(presentationModel.detailKeyThreeTextProperty());
        state.detailValueThreeTextProperty().bind(presentationModel.detailValueThreeTextProperty());
        state.sectionHeaderTextProperty().bind(presentationModel.sectionHeaderTextProperty());
        state.sectionValueTextProperty().bind(presentationModel.sectionValueTextProperty());
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
