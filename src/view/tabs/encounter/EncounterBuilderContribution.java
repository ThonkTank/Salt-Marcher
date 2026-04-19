package src.view.tabs.encounter;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ContributionKey;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import shell.api.ShellTabMode;
import shell.api.ShellTabSpec;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.EncounterApplicationService;
import src.domain.party.PartyApplicationService;

public final class EncounterBuilderContribution implements ShellContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public EncounterBuilderContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("encounter"),
                new NavigationGroupSpec("world", "World", 20),
                30,
                false,
                null,
                ShellTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        var services = Objects.requireNonNull(runtimeContext, "runtimeContext").services();
        EncounterApplicationService encounters = new EncounterApplicationService(
                services.require(PartyApplicationService.class),
                services.require(CreaturesApplicationService.class));
        EncounterBuilderViewModel viewModel = new EncounterBuilderViewModel(encounters);
        EncounterControlsView controls = new EncounterControlsView();
        EncounterMainView main = new EncounterMainView();
        EncounterStateView state = new EncounterStateView();
        main.resultTextProperty().bind(viewModel.resultProperty());
        state.stateTextProperty().bind(viewModel.stateProperty());
        controls.onGenerate(viewModel::generate);
        viewModel.generate();
        return new Binding(controls, main, state);
    }

    private record Binding(
            Node controls,
            Node main,
            Node state
    ) implements ShellBinding {

        @Override
        public String title() {
            return "Encounter Builder";
        }

        @Override
        public String navigationLabel() {
            return "Encounter";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(
                    ShellSlot.COCKPIT_CONTROLS, controls,
                    ShellSlot.COCKPIT_MAIN, main,
                    ShellSlot.COCKPIT_STATE, state);
        }
    }
}
