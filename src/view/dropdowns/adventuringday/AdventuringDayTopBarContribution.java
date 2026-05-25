package src.view.dropdowns.adventuringday;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellTopBarSpec;

public final class AdventuringDayTopBarContribution implements ShellContribution {

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTopBarSpec(new ContributionKey("adventuring-day"), 10);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        return new AdventuringDayTopBarBinder(Objects.requireNonNull(runtimeContext, "runtimeContext")).bind();
    }
}
