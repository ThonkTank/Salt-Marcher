package src.view.encounter;

import javafx.scene.Node;
import javafx.scene.layout.VBox;
import shell.host.ContributionKey;
import shell.host.NavigationGroupSpec;
import shell.host.NavigationIcons;
import shell.host.ShellContributionSpec;
import shell.host.ShellRuntimeContext;
import shell.host.ShellScreen;
import shell.host.ShellSlot;
import shell.host.ShellTabMode;
import shell.host.ShellTabSpec;
import shell.host.ShellViewContribution;
import src.domain.creatures.creaturesAPI;
import src.domain.encounter.encounterAPI;
import src.domain.party.partyAPI;
import src.view.encounter.Controller.EncounterController;
import src.view.encounter.Model.EncounterModel;
import src.view.encounter.View.EncounterView;
import src.view.encounter.interactor.EncounterInteractor;

import java.util.Map;

public final class EncounterViewContribution implements ShellViewContribution {

    public EncounterViewContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("encounter"),
                new NavigationGroupSpec("world", "World", 20),
                30,
                false,
                ShellTabMode.RUNTIME);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        partyAPI party = runtimeContext.persistence().require(partyAPI.Factory.class).create();
        creaturesAPI creatures = runtimeContext.persistence().require(creaturesAPI.Factory.class).create();
        EncounterModel model = new EncounterModel();
        EncounterInteractor interactor = new EncounterInteractor(new encounterAPI(party, creatures), creatures, model);
        EncounterController controller = new EncounterController(interactor);
        controller.initialize();
        EncounterView view = new EncounterView(model, controller);
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
            public Node getNavigationGraphic() {
                return NavigationIcons.encounter();
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(
                        ShellSlot.COCKPIT_CONTROLS, new VBox(12, view.controls(), view.state()),
                        ShellSlot.COCKPIT_MAIN, view.workspace());
            }
        };
    }
}
