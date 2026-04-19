package src.view.dungeonshared;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ContributionKey;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellRuntimeStateSpec;
import shell.api.ShellScreen;
import shell.api.ShellSlot;
import shell.api.ShellViewContribution;
import src.view.dungeonshared.View.DungeonSelectionInspectorContent;
import src.view.dungeonshared.View.DungeonTravelRuntimeSession;
import src.view.dungeonshared.ViewModel.DungeonSelectionInspectorEntry;
import src.view.dungeonshared.ViewModel.DungeonSelectionPublisher;

public final class DungeonsharedViewContribution implements ShellViewContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public DungeonsharedViewContribution() {
        // Required by shell discovery.
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellRuntimeStateSpec(new ContributionKey("dungeon-travel-state"), "Travel", 20);
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
                return "Dungeon Travel State";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(ShellSlot.COCKPIT_STATE, session.state());
            }
        };
    }

    private static final class DungeonSelectionInspectorShellAdapter implements DungeonSelectionPublisher {

        private final InspectorSink inspector;

        private DungeonSelectionInspectorShellAdapter(InspectorSink inspector) {
            this.inspector = Objects.requireNonNull(inspector, "inspector");
        }

        @Override
        public void clear() {
            inspector.clear();
        }

        @Override
        public void showSelection(DungeonSelectionInspectorEntry entry) {
            inspector.push(new InspectorEntrySpec(
                    entry.label(),
                    entry.inspectorKey(),
                    () -> DungeonSelectionInspectorContent.build(entry),
                    null
            ));
        }
    }
}
