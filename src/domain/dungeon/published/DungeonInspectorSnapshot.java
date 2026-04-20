package src.domain.dungeon.published;

import java.util.List;

/**
 * Read-only inspector payload published by the dungeon API.
 */
public record DungeonInspectorSnapshot(
        String title,
        String summary,
        List<String> facts
) {

    public DungeonInspectorSnapshot {
        title = title == null || title.isBlank() ? "Dungeon" : title;
        summary = summary == null ? "" : summary;
        facts = facts == null ? List.of() : List.copyOf(facts);
    }
}
