package src.view.dungeonshared.ViewModel;

import java.util.List;

public record DungeonSelectionInspectorEntry(
        String label,
        Object inspectorKey,
        String title,
        String summary,
        List<String> facts
) {

    public DungeonSelectionInspectorEntry {
        facts = facts == null ? List.of() : List.copyOf(facts);
    }
}
