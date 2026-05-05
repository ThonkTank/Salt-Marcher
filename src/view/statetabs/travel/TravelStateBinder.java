package src.view.statetabs.travel;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;

final class TravelStateBinder {

    private static final int TEXT_SLOT_COUNT = 6;
    private static final int DETAIL_SLOT_COUNT = 3;

    TravelStateBinder(ShellRuntimeContext runtimeContext) {
        Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        TravelStateContributionModel presentationModel = new TravelStateContributionModel();
        TravelStateView state = new TravelStateView();
        for (int index = 0; index < TEXT_SLOT_COUNT; index++) {
            state.textProperty(index).bind(presentationModel.textProperty(index));
        }
        for (int index = 0; index < DETAIL_SLOT_COUNT; index++) {
            state.detailKeyProperty(index).bind(presentationModel.detailKeyProperty(index));
            state.detailValueProperty(index).bind(presentationModel.detailValueProperty(index));
        }
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
