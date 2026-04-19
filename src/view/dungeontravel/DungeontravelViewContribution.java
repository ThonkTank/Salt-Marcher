package src.view.dungeontravel;

import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import javafx.scene.Node;
import shell.api.ContributionKey;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.NavigationGroupSpec;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellSlot;
import shell.api.ShellTabMode;
import shell.api.ShellTabSpec;
import shell.api.ShellViewContribution;
import src.view.dungeonmap.View.DungeonSelectionInspectorContent;
import src.view.dungeonmap.View.DungeonTravelRuntimeSession;
import src.view.dungeonmap.api.DungeonSelectionInspectorEntry;
import src.view.dungeonmap.api.DungeonSelectionPublisher;
import src.view.dungeontravel.View.DungeonTravelNavigationGraphic;

/**
 * Travel/runtime tab root for dungeon navigation.
 */
public final class DungeontravelViewContribution implements ShellViewContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public DungeontravelViewContribution() {
    }

    @Override
    @SuppressWarnings({"rawtypes", "unchecked"})
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("dungeon-travel"),
                new NavigationGroupSpec("world", "World", 20),
                20,
                false,
                navigationGraphicSupplier(),
                ShellTabMode.RUNTIME
        );
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        Objects.requireNonNull(runtimeContext, "runtimeContext");
        DungeonTravelRuntimeSession session = runtimeContext.session(
                DungeonTravelRuntimeSession.class,
                () -> DungeonTravelRuntimeSession.create(
                        new DungeonSelectionInspectorShellAdapter(runtimeContext.inspector())));
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
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(
                        ShellSlot.COCKPIT_CONTROLS, session.controls(),
                        ShellSlot.COCKPIT_MAIN, session.workspace()
                );
            }
        };
    }

    private static Supplier<Node> navigationGraphicSupplier() {
        return DungeonTravelNavigationGraphic::create;
    }

    private static final class DungeonSelectionInspectorShellAdapter implements DungeonSelectionPublisher {

        private final InspectorSink inspectorSink;

        private DungeonSelectionInspectorShellAdapter(InspectorSink inspectorSink) {
            this.inspectorSink = Objects.requireNonNull(inspectorSink, "inspectorSink");
        }

        @Override
        public void clear() {
            inspectorSink.clear();
        }

        @Override
        public void showSelection(DungeonSelectionInspectorEntry entry) {
            inspectorSink.push(new InspectorEntrySpec(
                    entry.label(),
                    entry.inspectorKey(),
                    () -> DungeonSelectionInspectorContent.build(entry),
                    null
            ));
        }
    }
}
