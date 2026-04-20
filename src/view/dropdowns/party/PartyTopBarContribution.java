package src.view.dropdowns.party;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellTopBarSpec;

public final class PartyTopBarContribution implements ShellContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public PartyTopBarContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTopBarSpec(new ContributionKey("party"), 20);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        return new PartyTopBarBinder(Objects.requireNonNull(runtimeContext, "runtimeContext")).bind();
    }
}
