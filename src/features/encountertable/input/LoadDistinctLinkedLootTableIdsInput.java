package features.encountertable.input;

import java.util.List;

@SuppressWarnings("unused")
public record LoadDistinctLinkedLootTableIdsInput(List<Long> encounterTableIds) {

    public enum Status {
        SUCCESS,
        STORAGE_ERROR
    }

    public record LoadedDistinctLinkedLootTableIdsInput(Status status, List<Long> lootTableIds) {
    }
}
