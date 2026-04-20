package src.view.runtimetabs.encounter;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellRuntimeStateSpec;

public final class EncounterRuntimeStateContribution implements ShellContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public EncounterRuntimeStateContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellRuntimeStateSpec(
                new ContributionKey("encounter"),
                "Encounter",
                30);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        return new EncounterRuntimeStateBinder(Objects.requireNonNull(runtimeContext, "runtimeContext")).bind();
    }
}
