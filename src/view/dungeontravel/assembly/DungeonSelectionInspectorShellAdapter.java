package src.view.dungeontravel.assembly;

import java.util.Objects;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import src.view.dungeonshared.api.DungeonSelectionInspectorContent;
import src.view.dungeonshared.api.DungeonSelectionInspectorEntry;
import src.view.dungeonshared.api.DungeonSelectionPublisher;

public final class DungeonSelectionInspectorShellAdapter implements DungeonSelectionPublisher {

    private final InspectorSink inspectorSink;

    public DungeonSelectionInspectorShellAdapter(InspectorSink inspectorSink) {
        this.inspectorSink = Objects.requireNonNull(inspectorSink, "inspectorSink");
    }

    @Override
    public void clear() {
        inspectorSink.clear();
    }

    @Override
    public void showSelection(DungeonSelectionInspectorEntry entry) {
        inspectorSink.push(newInspectorEntry(entry));
    }

    private static InspectorEntrySpec newInspectorEntry(DungeonSelectionInspectorEntry entry) {
        return new InspectorEntrySpec(
                entry.label(),
                entry.inspectorKey(),
                () -> DungeonSelectionInspectorContent.build(entry),
                null
        );
    }
}
