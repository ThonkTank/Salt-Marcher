package src.view.party;

import javafx.scene.Node;
import shell.host.ContributionKey;
import shell.host.ShellContributionSpec;
import shell.host.ShellRuntimeContext;
import shell.host.ShellScreen;
import shell.host.ShellTopBarSpec;
import shell.host.ShellViewContribution;
import shell.panel.ShellSlot;
import src.domain.party.partyAPI;
import src.domain.party.repository.PartyRosterRepository;
import src.view.party.Controller.PartyController;
import src.view.party.Model.PartyToolbarModel;
import src.view.party.View.PartyToolbarView;
import src.view.party.interactor.PartyInteractor;

import java.util.Map;

public final class PartyViewContribution implements ShellViewContribution {

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTopBarSpec(new ContributionKey("party"), 20);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        PartyToolbarModel model = new PartyToolbarModel();
        PartyRosterRepository repository = runtimeContext.persistence().require(PartyRosterRepository.class);
        PartyInteractor interactor = new PartyInteractor(new partyAPI(repository), model);
        PartyController controller = new PartyController(interactor);
        PartyToolbarView view = new PartyToolbarView(model, controller);
        controller.initialize();
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Party";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(ShellSlot.TOP_BAR, view.node());
            }
        };
    }
}
