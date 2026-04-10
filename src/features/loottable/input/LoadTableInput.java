package features.loottable.input;

import java.util.List;

@SuppressWarnings("unused")
public record LoadTableInput(Long tableId) {

    public enum Status {
        SUCCESS,
        NOT_FOUND,
        STORAGE_ERROR
    }

    public record EntryInput(
            long itemId,
            String itemName,
            String category,
            String rarity,
            int costCp,
            String costDisplay,
            int weight
    ) {
    }

    public record TableInput(
            long tableId,
            String name,
            String description,
            List<EntryInput> entries
    ) {
    }

    public record LoadedTableInput(Status status, TableInput table) {
    }
}
