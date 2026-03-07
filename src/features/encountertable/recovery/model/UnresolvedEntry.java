package features.encountertable.recovery.model;

public record UnresolvedEntry(long tableId, String tableName, EntrySnapshot entry) {}
