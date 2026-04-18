package src.view.dungeontravelstate.assembly;

import java.util.Objects;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import src.view.dungeonshared.api.DungeonSelectionInspectorContent;
import src.view.dungeonshared.api.DungeonSelectionInspectorEntry;
import src.view.dungeonshared.api.DungeonSelectionPublisher;

public final class DungeonSelectionInspectorShellAdapter implements DungeonSelectionPublisher {

    private final InspectorSink inspector;

    public DungeonSelectionInspectorShellAdapter(InspectorSink inspector) {
        this.inspector = Objects.requireNonNull(inspector, "inspector");
    }

    @Override
    public void clear() {
        inspector.clear();
    }

    @Override
    public void showSelection(DungeonSelectionInspectorEntry entry) {
        InspectorEntrySpec spec = new InspectorEntrySpec(
                entry.label(),
                entry.inspectorKey(),
                () -> DungeonSelectionInspectorContent.build(entry),
                null);
        inspector.push(spec);
    }
}
