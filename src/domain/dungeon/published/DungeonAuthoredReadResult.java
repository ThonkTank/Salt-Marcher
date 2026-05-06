package src.domain.dungeon.published;

public sealed interface DungeonAuthoredReadResult permits
        DungeonAuthoredReadResult.CommittedSnapshot,
        DungeonAuthoredReadResult.SelectionInspector {

    record CommittedSnapshot(DungeonSnapshot snapshot) implements DungeonAuthoredReadResult {

        public CommittedSnapshot {
            snapshot = snapshot == null ? new DungeonSnapshot("", null, null, null, null, 0) : snapshot;
        }
    }

    record SelectionInspector(DungeonInspectorSnapshot inspector) implements DungeonAuthoredReadResult {

        public SelectionInspector {
            inspector = inspector == null ? new DungeonInspectorSnapshot("", "", null) : inspector;
        }
    }
}
