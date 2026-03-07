package features.encountertable.recovery.model;

import java.util.List;

public record TableSnapshot(long tableId, String name, String description, List<EntrySnapshot> entries) {}
