package src.view.topbar.party;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import shell.api.ShellTopBarSpec;
import src.domain.party.PartyApplicationService;

public final class PartyTopBarContribution implements ShellContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public PartyTopBarContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTopBarSpec(new ContributionKey("party"), 20);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        PartyApplicationService party = Objects.requireNonNull(runtimeContext, "runtimeContext")
                .services()
                .require(PartyApplicationService.class);
        PartyTopBarViewModel viewModel = new PartyTopBarViewModel(party);
        PartyTopBarView panel = new PartyTopBarView();
        panel.summaryTextProperty().bind(viewModel.summaryProperty());
        panel.onRefresh(viewModel::refresh);
        viewModel.refresh();
        return new Binding(panel);
    }

    private record Binding(Node topBar) implements ShellBinding {

        @Override
        public String title() {
            return "Party";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(ShellSlot.TOP_BAR, topBar);
        }
    }
}
