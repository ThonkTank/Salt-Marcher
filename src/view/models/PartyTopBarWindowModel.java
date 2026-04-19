package src.view.models;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellContributionModel;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import shell.api.ShellTopBarSpec;
import src.domain.party.PartyApplicationService;
import src.view.views.PartyTopBarView;

public final class PartyTopBarWindowModel implements ShellContributionModel {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public PartyTopBarWindowModel() {
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
        PartyTopBarView panel = new PartyTopBarView();
        Runnable refresh = () -> panel.showSummary(String.valueOf(party.loadSnapshot()));
        panel.onRefresh(refresh);
        refresh.run();
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
