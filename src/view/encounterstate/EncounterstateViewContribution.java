package src.view.encounterstate;

import shell.api.ContributionKey;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellRuntimeStateSpec;
import shell.api.ShellScreen;
import shell.api.ShellViewContribution;
import src.view.encounterstate.assembly.EncounterstateAssembly;

public final class EncounterstateViewContribution implements ShellViewContribution {

    public EncounterstateViewContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellRuntimeStateSpec(new ContributionKey("encounter-state"), "Encounter", 10);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        return EncounterstateAssembly.createScreen(runtimeContext);
    }
}
