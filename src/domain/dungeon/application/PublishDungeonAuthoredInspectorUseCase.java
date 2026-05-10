package src.domain.dungeon.application;

import src.domain.dungeon.published.DungeonInspectorSnapshot;

final class PublishDungeonAuthoredInspectorUseCase {

    DungeonInspectorSnapshot inspector(LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot) {
        return new DungeonInspectorSnapshot(
                snapshot.title(),
                snapshot.description(),
                snapshot.facts(),
                snapshot.roomNarrations().stream()
                        .map(roomNarration -> new DungeonInspectorSnapshot.RoomNarrationCard(
                                roomNarration.roomId(),
                                roomNarration.roomName(),
                                roomNarration.visualDescription(),
                                roomNarration.exits().stream()
                                        .map(exit -> new DungeonInspectorSnapshot.RoomExitNarration(
                                                exit.label(),
                                                PublishDungeonAuthoredRefUseCase.cell(exit.cell()),
                                                exit.direction().name(),
                                                exit.description()))
                                        .toList()))
                        .toList());
    }
}
