package src.view.statetabs.travel;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellStateTabSpec;

public final class TravelStateContribution implements ShellContribution {

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellStateTabSpec(
                new ContributionKey("travel"),
                "Reise",
                40);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        return new TravelStateBinder(Objects.requireNonNull(runtimeContext, "runtimeContext")).bind();
    }
}
