package src.view.models;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ContributionKey;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContributionModel;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import shell.api.ShellTabMode;
import shell.api.ShellTabSpec;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.api.EncounterDifficultyBand;
import src.domain.encounter.api.EncounterGenerationRequest;
import src.domain.party.PartyApplicationService;
import src.view.views.EncounterControlsView;
import src.view.views.EncounterMainView;
import src.view.views.EncounterStateView;

public final class EncounterBuilderTabModel implements ShellContributionModel {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public EncounterBuilderTabModel() {
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
        EncounterControlsView controls = new EncounterControlsView();
        EncounterMainView main = new EncounterMainView();
        EncounterStateView state = new EncounterStateView();
        Runnable generate = () -> {
            var result = encounters.generate(new EncounterGenerationRequest(
                    List.of(),
                    List.of(),
                    List.of(),
                    EncounterDifficultyBand.defaultBand(),
                    5,
                    List.of(),
                    List.of()));
            main.showResult(String.valueOf(result));
            state.showState("Encounter request sent through EncounterApplicationService.");
        };
        controls.onGenerate(generate);
        generate.run();
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
