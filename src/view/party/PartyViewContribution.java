package src.view.party;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ContributionKey;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellSlot;
import shell.api.ShellTopBarSpec;
import shell.api.ShellViewContribution;
import src.domain.party.PartyApplicationService;
import src.view.party.View.PartyToolbarView;
import src.view.party.ViewModel.PartyToolbarViewModel;

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
        Objects.requireNonNull(runtimeContext, "runtimeContext");
        PartyApplicationService party = runtimeContext.services().require(PartyApplicationService.class);
        PartyToolbarViewModel viewModel = new PartyToolbarViewModel(party);
        PartyToolbarView view = new PartyToolbarView(viewModel);
        viewModel.initialize();
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
