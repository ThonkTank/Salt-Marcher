package src.domain.dungeon.model.runtime.usecase;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository;

final class DungeonInspectorPublicationMapper {

    private DungeonInspectorPublicationMapper() {
    }

    static DungeonAuthoredPublishedStateRepository.@Nullable InspectorPublication inspectorPublication(
            LoadDungeonSnapshotUseCase.@Nullable InspectorSnapshotData inspector
    ) {
        if (inspector == null) {
            return null;
        }
        return new DungeonAuthoredPublishedStateRepository.InspectorPublication(
                inspector.title(),
                inspector.description(),
                inspector.facts(),
                statePanelFacts(inspector.statePanelFacts()),
                roomNarrationPublications(inspector.roomNarrations()));
    }

    private static DungeonAuthoredPublishedStateRepository.StatePanelFacts statePanelFacts(
            LoadDungeonSnapshotUseCase.StatePanelFacts facts
    ) {
        LoadDungeonSnapshotUseCase.StatePanelFacts safeFacts = facts == null
                ? LoadDungeonSnapshotUseCase.StatePanelFacts.empty()
                : facts;
        return new DungeonAuthoredPublishedStateRepository.StatePanelFacts(
                stairGeometryFacts(safeFacts.stairGeometry()),
                transitionDestinationFacts(safeFacts.transitionDestination()));
    }

    private static DungeonAuthoredPublishedStateRepository.StairGeometryPublication stairGeometryFacts(
            LoadDungeonSnapshotUseCase.StairGeometryPanelFacts facts
    ) {
        LoadDungeonSnapshotUseCase.StairGeometryPanelFacts safeFacts = facts == null
                ? LoadDungeonSnapshotUseCase.StairGeometryPanelFacts.empty()
                : facts;
        return new DungeonAuthoredPublishedStateRepository.StairGeometryPublication(
                safeFacts.present(),
                safeFacts.stairId(),
                safeFacts.shapeName(),
                safeFacts.directionName(),
                safeFacts.dimension1(),
                safeFacts.dimension2());
    }

    private static DungeonAuthoredPublishedStateRepository.TransitionDestinationPublication
            transitionDestinationFacts(LoadDungeonSnapshotUseCase.TransitionDestinationPanelFacts facts) {
        LoadDungeonSnapshotUseCase.TransitionDestinationPanelFacts safeFacts = facts == null
                ? LoadDungeonSnapshotUseCase.TransitionDestinationPanelFacts.empty()
                : facts;
        return new DungeonAuthoredPublishedStateRepository.TransitionDestinationPublication(
                safeFacts.present(),
                safeFacts.destinationTypeKey(),
                safeFacts.mapId(),
                safeFacts.tileId(),
                safeFacts.transitionId());
    }

    private static List<DungeonAuthoredPublishedStateRepository.RoomNarrationPublication> roomNarrationPublications(
            List<LoadDungeonSnapshotUseCase.RoomNarrationData> roomNarrations
    ) {
        List<DungeonAuthoredPublishedStateRepository.RoomNarrationPublication> result = new ArrayList<>();
        for (LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration : roomNarrations) {
            result.add(roomNarrationPublication(roomNarration));
        }
        return List.copyOf(result);
    }

    private static DungeonAuthoredPublishedStateRepository.RoomNarrationPublication roomNarrationPublication(
            LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration
    ) {
        return new DungeonAuthoredPublishedStateRepository.RoomNarrationPublication(
                roomNarration.roomId(),
                roomNarration.roomName(),
                roomNarration.visualDescription(),
                roomExitPublications(roomNarration.exits()));
    }

    private static List<DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication> roomExitPublications(
            List<LoadDungeonSnapshotUseCase.RoomExitNarrationData> exits
    ) {
        List<DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication> result = new ArrayList<>();
        for (LoadDungeonSnapshotUseCase.RoomExitNarrationData exit : exits) {
            result.add(new DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication(
                    exit.label(),
                    exit.cell(),
                    exit.direction(),
                    exit.description()));
        }
        return List.copyOf(result);
    }
}
