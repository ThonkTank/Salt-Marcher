package features.travel.adapter.javafx;

import features.travel.api.TravelContextModel;
import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellStateTabSpec;

public final class TravelStateContribution implements ShellContribution {

    private final TravelContextModel contextModel;

    public TravelStateContribution(TravelContextModel contextModel) {
        this.contextModel = Objects.requireNonNull(contextModel, "contextModel");
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
        contextModel.subscribe(viewModel::apply);
        viewModel.apply(contextModel.current());
        return ShellBinding.state("Reise", state);
    }
}
