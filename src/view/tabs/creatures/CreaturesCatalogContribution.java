package src.view.tabs.creatures;

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

public final class CreaturesCatalogContribution implements ShellContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public CreaturesCatalogContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("creatures"),
                new NavigationGroupSpec("reference", "Reference", 30),
                10,
                false,
                null,
                ShellTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        CreaturesApplicationService creatures = Objects.requireNonNull(runtimeContext, "runtimeContext")
                .services()
                .require(CreaturesApplicationService.class);
        CreaturesCatalogViewModel viewModel = new CreaturesCatalogViewModel(creatures);
        CreaturesControlsView controls = new CreaturesControlsView();
        CreaturesMainView main = new CreaturesMainView();
        main.summaryTextProperty().bind(viewModel.summaryProperty());
        controls.onLoad(viewModel::load);
        viewModel.load();
        return new Binding(controls, main);
    }

    private record Binding(
            Node controls,
            Node main
    ) implements ShellBinding {

        @Override
        public String title() {
            return "Creatures";
        }

        @Override
        public String navigationLabel() {
            return "Creatures";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(
                    ShellSlot.COCKPIT_CONTROLS, controls,
                    ShellSlot.COCKPIT_MAIN, main);
        }
    }
}
