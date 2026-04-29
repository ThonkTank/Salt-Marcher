package src.domain.dungeon.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record DungeonEditorSnapshot(
        List<DungeonMapSummary> maps,
        @Nullable DungeonMapId selectedMapId,
        @Nullable DungeonSurfacePayload surface,
        String statusText
) {

    public DungeonEditorSnapshot {
        maps = maps == null ? List.of() : List.copyOf(maps);
        statusText = statusText == null ? "" : statusText;
    }

    public static DungeonEditorSnapshot empty(String statusText) {
        return new DungeonEditorSnapshot(List.of(), null, null, statusText);
    }
}
