package src.view.creatures;

import javafx.scene.Node;
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
import src.view.creatures.Controller.CreaturesController;
import src.view.creatures.Model.CreaturesModel;
import src.view.creatures.View.CreaturesView;
import src.view.creatures.interactor.CreaturesInteractor;

import java.util.Map;

/**
 * Read-only creatures catalog tab root.
 */
public final class CreaturesViewContribution implements ShellViewContribution {

    public CreaturesViewContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("creatures"),
                new NavigationGroupSpec("reference", "Reference", 30),
                10,
                false,
                ShellTabMode.RUNTIME
        );
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        CreaturesModel model = new CreaturesModel();
        creaturesAPI creatures = runtimeContext.persistence().require(creaturesAPI.Factory.class).create();
        CreaturesInteractor interactor = new CreaturesInteractor(creatures, model, runtimeContext.inspector());
        CreaturesController controller = new CreaturesController(interactor);
        controller.initialize();
        CreaturesView view = new CreaturesView(model, controller);
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Creatures";
            }

            @Override
            public String getNavigationLabel() {
                return "Creatures";
            }

            @Override
            public Node getNavigationGraphic() {
                return NavigationIcons.tables();
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(
                        ShellSlot.COCKPIT_CONTROLS, view.controls(),
                        ShellSlot.COCKPIT_MAIN, view.workspace()
                );
            }
        };
    }
}
