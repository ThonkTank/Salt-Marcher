package src.view.dungeoneditor;

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
import src.view.dungeoneditor.View.DungeonEditorNavigationGraphic;
import src.view.dungeoneditor.View.DungeonEditorRuntimeSession;
import src.view.dungeonshared.View.DungeonSelectionInspectorContent;
import src.view.dungeonshared.ViewModel.DungeonSelectionInspectorEntry;
import src.view.dungeonshared.ViewModel.DungeonSelectionPublisher;

/**
 * Editor tab root for dungeon map work.
 */
public final class DungeoneditorViewContribution implements ShellViewContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public DungeoneditorViewContribution() {
    }

    @Override
    @SuppressWarnings({"rawtypes", "unchecked"})
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("dungeon-editor"),
                new NavigationGroupSpec("world", "World", 20),
                10,
                true,
                navigationGraphicSupplier(),
                ShellTabMode.EDITOR
        );
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        Objects.requireNonNull(runtimeContext, "runtimeContext");
        DungeonEditorRuntimeSession session = DungeonEditorRuntimeSession.create(
                new DungeonSelectionInspectorShellAdapter(runtimeContext.inspector()));
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Dungeon Editor";
            }

            @Override
            public String getNavigationLabel() {
                return "Dungeon";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(
                        ShellSlot.COCKPIT_CONTROLS, session.controls(),
                        ShellSlot.COCKPIT_MAIN, session.workspace(),
                        ShellSlot.COCKPIT_STATE, session.state()
                );
            }
        };
    }

    private static Supplier<Node> navigationGraphicSupplier() {
        return DungeonEditorNavigationGraphic::create;
    }

    private static final class DungeonSelectionInspectorShellAdapter implements DungeonSelectionPublisher {

        private final InspectorSink sink;

        private DungeonSelectionInspectorShellAdapter(InspectorSink sink) {
            this.sink = Objects.requireNonNull(sink, "sink");
        }

        @Override
        public void clear() {
            sink.clear();
        }

        @Override
        public void showSelection(DungeonSelectionInspectorEntry selection) {
            sink.push(new InspectorEntrySpec(
                    selection.label(),
                    selection.inspectorKey(),
                    () -> DungeonSelectionInspectorContent.build(selection),
                    null));
        }
    }
}
