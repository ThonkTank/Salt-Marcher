package src.view.encounter;

import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import javafx.scene.Node;
import shell.api.ContributionKey;
import shell.api.NavigationGroupSpec;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellSlot;
import shell.api.ShellTabMode;
import shell.api.ShellTabSpec;
import shell.api.ShellViewContribution;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.EncounterApplicationService;
import src.domain.party.PartyApplicationService;
import src.view.encounter.View.EncounterNavigationGraphic;
import src.view.encounter.View.EncounterRuntimeSession;
import src.view.encounter.ViewModel.EncounterViewModel;

public final class EncounterViewContribution implements ShellViewContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public EncounterViewContribution() {
    }

    @Override
    @SuppressWarnings({"rawtypes", "unchecked"})
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("encounter"),
                new NavigationGroupSpec("world", "World", 20),
                30,
                false,
                navigationGraphicSupplier(),
                ShellTabMode.RUNTIME);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        Objects.requireNonNull(runtimeContext, "runtimeContext");
        EncounterRuntimeSession session = runtimeContext.session(
                EncounterRuntimeSession.class,
                () -> createRuntimeSession(runtimeContext));
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Encounter Builder";
            }

            @Override
            public String getNavigationLabel() {
                return "Encounter";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(
                        ShellSlot.COCKPIT_CONTROLS, session.controls(),
                        ShellSlot.COCKPIT_MAIN, session.workspace(),
                        ShellSlot.COCKPIT_STATE, session.state());
            }
        };
    }

    private static Supplier<Node> navigationGraphicSupplier() {
        return EncounterNavigationGraphic::create;
    }

    private static EncounterRuntimeSession createRuntimeSession(ShellRuntimeContext runtimeContext) {
        var services = runtimeContext.services();
        PartyApplicationService party = services.require(PartyApplicationService.class);
        CreaturesApplicationService creatures = services.require(CreaturesApplicationService.class);
        EncounterApplicationService encounters = new EncounterApplicationService(party, creatures);
        return EncounterRuntimeSession.create(new EncounterViewModel(encounters, creatures));
    }
}
