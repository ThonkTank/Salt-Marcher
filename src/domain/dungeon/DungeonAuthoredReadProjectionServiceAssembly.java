package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;
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

    static src.domain.dungeon.published.DungeonInspectorSnapshot inspector(
            src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.InspectorPublication inspector
    ) {
        return new src.domain.dungeon.published.DungeonInspectorSnapshot(
                inspector.title(),
                inspector.description(),
                inspector.facts(),
                statePanelFacts(inspector.statePanelFacts()),
                roomNarrations(inspector));
    }

    private static src.domain.dungeon.published.DungeonInspectorSnapshot.StatePanelFacts statePanelFacts(
            src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.StatePanelFacts facts
    ) {
        src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.StatePanelFacts
                safeFacts = facts == null
                        ? src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.StatePanelFacts.empty()
                        : facts;
        return new src.domain.dungeon.published.DungeonInspectorSnapshot.StatePanelFacts(
                stairGeometryFacts(safeFacts.stairGeometry()),
                transitionDestinationFacts(safeFacts.transitionDestination()));
    }

    private static src.domain.dungeon.published.DungeonInspectorSnapshot.StairGeometryFacts stairGeometryFacts(
            src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.StairGeometryPublication facts
    ) {
        src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.StairGeometryPublication
                safeFacts = facts == null
                        ? src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.StairGeometryPublication.empty()
                        : facts;
        return new src.domain.dungeon.published.DungeonInspectorSnapshot.StairGeometryFacts(
                safeFacts.present(),
                safeFacts.stairId(),
                safeFacts.shapeName(),
                safeFacts.directionName(),
                safeFacts.dimension1(),
                safeFacts.dimension2());
    }

    private static src.domain.dungeon.published.DungeonInspectorSnapshot.TransitionDestinationFacts
            transitionDestinationFacts(
                    src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.TransitionDestinationPublication facts
            ) {
        src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.TransitionDestinationPublication
                safeFacts = facts == null
                        ? src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.TransitionDestinationPublication.empty()
                        : facts;
        return new src.domain.dungeon.published.DungeonInspectorSnapshot.TransitionDestinationFacts(
                safeFacts.present(),
                safeFacts.destinationTypeKey(),
                safeFacts.mapId(),
                safeFacts.tileId(),
                safeFacts.transitionId());
    }

    private static String aggregateSummary(src.domain.dungeon.model.core.projection.DungeonState aggregate) {
        return aggregate.label() + " #" + aggregate.id();
    }

    private static List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard> roomNarrations(
            src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.InspectorPublication snapshot
    ) {
        List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard> roomNarrations = new ArrayList<>();
        for (src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.RoomNarrationPublication roomNarration :
                snapshot.roomNarrations()) {
            roomNarrations.add(roomNarration(roomNarration));
        }
        return List.copyOf(roomNarrations);
    }

    private static src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard roomNarration(
            src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.RoomNarrationPublication roomNarration
    ) {
        return new src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard(
                roomNarration.roomId(),
                roomNarration.roomName(),
                roomNarration.visualDescription(),
                recordRoomExits(roomNarration.exits()));
    }

    private static List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration> recordRoomExits(
            List<src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication> exits
    ) {
        List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration> result = new ArrayList<>();
        for (src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication exit : exits) {
            result.add(new src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration(
                    exit.label(),
                    DungeonPublishedMapProjectionServiceAssembly.cell(exit.cell()),
                    exit.direction().name(),
                    exit.description()));
        }
        return List.copyOf(result);
    }
}
