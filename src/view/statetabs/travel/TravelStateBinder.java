package src.view.statetabs.travel;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.hex.published.HexTravelModel;

final class TravelStateBinder {

    private final ShellRuntimeContext runtimeContext;

    TravelStateBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        TravelStateContributionModel contributionModel = new TravelStateContributionModel();
        TravelStateView state = new TravelStateView();
        state.bind(contributionModel.stateContentModel());
        runtimeContext.services().find(HexTravelModel.class).ifPresent(hexTravelModel -> {
            hexTravelModel.subscribe(contributionModel.stateContentModel()::applyHexTravelSnapshot);
            contributionModel.stateContentModel().applyHexTravelSnapshot(hexTravelModel.current());
        });
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
