package src.view.state.encounter;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeStateSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.EncounterApplicationService;
import src.domain.party.PartyApplicationService;

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
        var services = Objects.requireNonNull(runtimeContext, "runtimeContext").services();
        EncounterApplicationService encounters = new EncounterApplicationService(
                services.require(PartyApplicationService.class),
                services.require(CreaturesApplicationService.class));
        EncounterRuntimeStateViewModel viewModel = new EncounterRuntimeStateViewModel(encounters);
        EncounterStateView state = new EncounterStateView();
        state.stateTextProperty().bind(viewModel.stateProperty());
        viewModel.generate();
        return new Binding(state);
    }

    private record Binding(Node state) implements ShellBinding {

        @Override
        public String title() {
            return "Encounter";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(ShellSlot.COCKPIT_STATE, state);
        }
    }
}
