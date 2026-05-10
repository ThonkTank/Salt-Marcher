package src.domain.dungeon.application;

import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonSnapshot;

final class PublishDungeonAuthoredSnapshotUseCase {

    private final PublishDungeonAuthoredMapSnapshotUseCase mapSnapshotUseCase =
            new PublishDungeonAuthoredMapSnapshotUseCase();

    DungeonSnapshot snapshot(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
        return new DungeonSnapshot(
                snapshot.mapName(),
                DungeonMapMode.EDITOR,
                mapSnapshotUseCase.mapSnapshot(snapshot.derived().map(), snapshot.editorHandles()),
                snapshot.derived().aggregates().stream().map(PublishDungeonAuthoredScalarUseCase::aggregateSummary).toList(),
                snapshot.derived().relations().summaries(),
                PublishDungeonAuthoredScalarUseCase.revision(snapshot.revision()));
    }
}
