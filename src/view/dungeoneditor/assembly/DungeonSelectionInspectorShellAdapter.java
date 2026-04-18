package src.view.dungeoneditor.assembly;

import java.util.Objects;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import src.view.dungeonshared.api.DungeonSelectionInspectorContent;
import src.view.dungeonshared.api.DungeonSelectionInspectorEntry;
import src.view.dungeonshared.api.DungeonSelectionPublisher;

public final class DungeonSelectionInspectorShellAdapter implements DungeonSelectionPublisher {

    private final InspectorSink sink;

    public DungeonSelectionInspectorShellAdapter(InspectorSink sink) {
        this.sink = Objects.requireNonNull(sink, "sink");
    }

    @Override
    public void clear() {
        sink.clear();
    }

    @Override
    public void showSelection(DungeonSelectionInspectorEntry selection) {
        sink.push(toEntrySpec(selection));
    }

    private static InspectorEntrySpec toEntrySpec(DungeonSelectionInspectorEntry selection) {
        return new InspectorEntrySpec(
                selection.label(),
                selection.inspectorKey(),
                () -> DungeonSelectionInspectorContent.build(selection),
                null);
    }
}
