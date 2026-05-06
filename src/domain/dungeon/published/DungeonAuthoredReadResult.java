package src.domain.dungeon.published;

public sealed interface DungeonAuthoredReadResult permits
        DungeonAuthoredReadResult.CommittedSnapshot,
        DungeonAuthoredReadResult.SelectionInspector {

    record CommittedSnapshot(DungeonSnapshot snapshot) implements DungeonAuthoredReadResult { }

    record SelectionInspector(DungeonInspectorSnapshot inspector) implements DungeonAuthoredReadResult { }
}
