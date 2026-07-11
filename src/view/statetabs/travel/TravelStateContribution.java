package src.view.statetabs.travel;

import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellStateTabSpec;
import src.domain.hex.published.HexTravelModel;

public final class TravelStateContribution implements ShellContribution {

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellStateTabSpec(new ContributionKey("travel"), "Reise", 40);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        TravelStateViewModel viewModel = new TravelStateViewModel();
        TravelStateView state = new TravelStateView();
        state.bind(viewModel);
        runtimeContext.services().find(HexTravelModel.class).ifPresent(hexTravelModel -> {
            hexTravelModel.subscribe(viewModel::applyHexTravelSnapshot);
            viewModel.applyHexTravelSnapshot(hexTravelModel.current());
        });
        return ShellBinding.state("Reise", state);
    }
}
