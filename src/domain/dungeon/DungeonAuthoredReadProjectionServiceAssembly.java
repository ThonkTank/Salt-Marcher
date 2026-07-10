package src.domain.dungeon;

import org.jspecify.annotations.Nullable;

final class DungeonAuthoredReadProjectionServiceAssembly {

    private DungeonAuthoredReadProjectionServiceAssembly() {
    }

    static src.domain.dungeon.published.DungeonAuthoredReadResult defaultRead() {
        return new src.domain.dungeon.published.DungeonAuthoredReadResult.CommittedSnapshot(
                DungeonPublishedMapProjectionServiceAssembly.defaultSnapshot());
    }

    static src.domain.dungeon.published.DungeonSnapshot snapshot(
            src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.@Nullable SnapshotPublication snapshot
    ) {
        if (snapshot == null) {
            return DungeonPublishedMapProjectionServiceAssembly.defaultSnapshot();
        }
        src.domain.dungeon.model.core.projection.DungeonDerivedState derived = snapshot.derived();
        return new src.domain.dungeon.published.DungeonSnapshot(
                snapshot.mapName(),
                src.domain.dungeon.published.DungeonMapMode.EDITOR,
                DungeonPublishedMapProjectionServiceAssembly.mapSnapshot(derived.map(), snapshot.editorHandles()),
                derived.aggregates().stream().map(DungeonAuthoredReadProjectionServiceAssembly::aggregateSummary).toList(),
                derived.relations().summaries(),
                DungeonPublishedMapProjectionServiceAssembly.revision(snapshot.revision()));
    }

    static src.domain.dungeon.published.DungeonSnapshot snapshot(
            DungeonAuthoredPublication.@Nullable Snapshot snapshot
    ) {
        return snapshot(snapshot == null ? null : snapshot.source());
    }

    static src.domain.dungeon.published.DungeonInspectorSnapshot inspector(
            DungeonAuthoredPublication.Inspector inspector
    ) {
        return DungeonAuthoredInspectorProjectionServiceAssembly.inspector(inspector);
    }

    private static String aggregateSummary(src.domain.dungeon.model.core.projection.DungeonState aggregate) {
        return aggregate.label() + " #" + aggregate.id();
    }
}
