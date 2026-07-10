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
            DungeonAuthoredPublication.@Nullable Snapshot snapshot
    ) {
        if (snapshot == null || snapshot.derived() == null) {
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
            DungeonAuthoredPublication.Inspector inspector
    ) {
        return new src.domain.dungeon.published.DungeonInspectorSnapshot(
                inspector.title(),
                inspector.description(),
                inspector.facts(),
                statePanelFacts(inspector.statePanelFacts()),
                roomNarrations(inspector));
    }

    private static String aggregateSummary(src.domain.dungeon.model.core.projection.DungeonState aggregate) {
        return aggregate.label() + " #" + aggregate.id();
    }

    private static src.domain.dungeon.published.DungeonInspectorSnapshot.StatePanelFacts statePanelFacts(
            DungeonAuthoredPublication.StatePanelFacts facts
    ) {
        return new src.domain.dungeon.published.DungeonInspectorSnapshot.StatePanelFacts(
                stairGeometryFacts(facts.stairGeometry()),
                transitionDestinationFacts(facts.transitionDestination()));
    }

    private static src.domain.dungeon.published.DungeonInspectorSnapshot.StairGeometryFacts stairGeometryFacts(
            DungeonAuthoredPublication.StairGeometry facts
    ) {
        return new src.domain.dungeon.published.DungeonInspectorSnapshot.StairGeometryFacts(
                facts.present(),
                facts.stairId(),
                facts.shapeName(),
                facts.directionName(),
                facts.dimension1(),
                facts.dimension2());
    }

    private static src.domain.dungeon.published.DungeonInspectorSnapshot.TransitionDestinationFacts
            transitionDestinationFacts(
                    DungeonAuthoredPublication.TransitionDestination facts
            ) {
        return new src.domain.dungeon.published.DungeonInspectorSnapshot.TransitionDestinationFacts(
                facts.present(),
                facts.destinationTypeKey(),
                facts.mapId(),
                facts.tileId(),
                facts.transitionId());
    }

    private static List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard> roomNarrations(
            DungeonAuthoredPublication.Inspector snapshot
    ) {
        List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard> roomNarrations = new ArrayList<>();
        for (DungeonAuthoredPublication.RoomNarration roomNarration : snapshot.roomNarrations()) {
            roomNarrations.add(roomNarration(roomNarration));
        }
        return List.copyOf(roomNarrations);
    }

    private static src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard roomNarration(
            DungeonAuthoredPublication.RoomNarration roomNarration
    ) {
        return new src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard(
                roomNarration.roomId(),
                roomNarration.roomName(),
                roomNarration.visualDescription(),
                recordPublishedRoomExits(roomNarration.exits()));
    }

    private static List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration>
            recordPublishedRoomExits(List<DungeonAuthoredPublication.RoomExitNarration> exits) {
        List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration> result = new ArrayList<>();
        for (DungeonAuthoredPublication.RoomExitNarration exit : exits) {
            result.add(new src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration(
                    exit.label(),
                    DungeonPublishedMapProjectionServiceAssembly.cell(exit.cell()),
                    exit.direction().name(),
                    exit.description()));
        }
        return List.copyOf(result);
    }
}
