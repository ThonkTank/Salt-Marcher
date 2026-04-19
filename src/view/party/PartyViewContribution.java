package src.view.party;

import shell.api.ContributionKey;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellTopBarSpec;
import shell.api.ShellViewContribution;
import src.view.party.assembly.PartyToolbarAssembly;

public final class PartyViewContribution implements ShellViewContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public PartyViewContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTopBarSpec(new ContributionKey("party"), 20);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        return PartyToolbarAssembly.createScreen(runtimeContext);
    }
}
