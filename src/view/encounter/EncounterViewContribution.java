package src.view.encounter;

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
import src.view.encounter.interactor.EncounterRuntimeSession;

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
        EncounterRuntimeSession session = EncounterRuntimeSession.from(runtimeContext);
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
                        ShellSlot.COCKPIT_CONTROLS, session.controls(),
                        ShellSlot.COCKPIT_MAIN, session.workspace());
            }
        };
    }
}
