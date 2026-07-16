package features.hex.adapter.javafx.travel;

import org.jspecify.annotations.Nullable;
import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellStateTabSpec;
import features.hex.api.HexTravelModel;

public final class TravelStateContribution implements ShellContribution {

    private final @Nullable HexTravelModel hexTravelModel;

    public TravelStateContribution(@Nullable HexTravelModel hexTravelModel) {
        this.hexTravelModel = hexTravelModel;
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellStateTabSpec(new ContributionKey("travel"), "Reise", 40);
    }

    @Override
    public ShellBinding bind() {
        TravelStateViewModel viewModel = new TravelStateViewModel();
        TravelStateView state = new TravelStateView();
        state.bind(viewModel);
        if (hexTravelModel != null) {
            hexTravelModel.subscribe(viewModel::applyHexTravelSnapshot);
            viewModel.applyHexTravelSnapshot(hexTravelModel.current());
        }
        return ShellBinding.state("Reise", state);
    }
}
