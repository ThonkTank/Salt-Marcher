package src.view.dungeontravel;

import javafx.scene.Node;
import shell.host.ContributionKey;
import shell.host.NavigationGroupSpec;
import shell.host.NavigationIcons;
import shell.host.ShellContributionSpec;
import shell.host.ShellRuntimeContext;
import shell.host.ShellScreen;
import shell.host.ShellTabMode;
import shell.host.ShellTabSpec;
import shell.host.ShellViewContribution;
import shell.host.ShellSlot;
import src.view.dungeontravel.interactor.DungeonTravelRuntimeSession;

import java.util.Map;

/**
 * Travel/runtime tab root for dungeon navigation.
 */
public final class DungeontravelViewContribution implements ShellViewContribution {

    public DungeontravelViewContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("dungeon-travel"),
                new NavigationGroupSpec("world", "World", 20),
                20,
                false,
                ShellTabMode.RUNTIME
        );
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        DungeonTravelRuntimeSession session = runtimeContext.session(
                DungeonTravelRuntimeSession.class,
                () -> new DungeonTravelRuntimeSession(runtimeContext.inspector()));
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Dungeon Travel";
            }

            @Override
            public String getNavigationLabel() {
                return "Travel";
            }

            @Override
            public Node getNavigationGraphic() {
                return NavigationIcons.dungeon();
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(
                        ShellSlot.COCKPIT_CONTROLS, session.controls(),
                        ShellSlot.COCKPIT_MAIN, session.workspace()
                );
            }
        };
    }
}
