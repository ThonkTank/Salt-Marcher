package features.encountertable.input;

import java.util.List;

@SuppressWarnings("unused")
public record LoadTableInput(Long tableId) {

    public enum Status {
        SUCCESS,
        NOT_FOUND,
        STORAGE_ERROR
    }

    public record EntryInput(
            long creatureId,
            String creatureName,
            String creatureType,
            String crDisplay,
            int xp,
            int weight
    ) {
    }

    public record TableInput(
            long tableId,
            String name,
            String description,
            Long linkedLootTableId,
            List<EntryInput> entries
    ) {
    }

    public record LoadedTableInput(Status status, TableInput table) {
    }
}
