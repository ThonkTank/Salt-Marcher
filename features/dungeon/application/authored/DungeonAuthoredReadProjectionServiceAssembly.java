package features.dungeon.application.authored;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;

final class DungeonAuthoredReadProjectionServiceAssembly {

    private DungeonAuthoredReadProjectionServiceAssembly() {
    }

    static features.dungeon.api.DungeonAuthoredReadResult defaultRead() {
        return new features.dungeon.api.DungeonAuthoredReadResult.CommittedSnapshot(
                DungeonPublishedMapProjectionServiceAssembly.defaultSnapshot());
    }

    static features.dungeon.api.DungeonSnapshot snapshot(
            DungeonAuthoredPublication.@Nullable Snapshot snapshot
    ) {
        if (snapshot == null || snapshot.derived() == null) {
            return DungeonPublishedMapProjectionServiceAssembly.defaultSnapshot();
        }
        features.dungeon.domain.core.projection.DungeonDerivedState derived = snapshot.derived();
        return new features.dungeon.api.DungeonSnapshot(
                snapshot.mapName(),
                features.dungeon.api.DungeonMapMode.EDITOR,
                DungeonPublishedMapProjectionServiceAssembly.mapSnapshot(derived.map(), snapshot.editorHandles()),
                derived.aggregates().stream().map(DungeonAuthoredReadProjectionServiceAssembly::aggregateSummary).toList(),
                derived.relations().summaries(),
                DungeonPublishedMapProjectionServiceAssembly.revision(snapshot.revision()));
    }

    static features.dungeon.api.DungeonInspectorSnapshot inspector(
            DungeonAuthoredPublication.Inspector inspector
    ) {
        return new features.dungeon.api.DungeonInspectorSnapshot(
                inspector.title(),
                inspector.description(),
                statePanelFacts(inspector.statePanelFacts()),
                roomNarrations(inspector));
    }

    private static String aggregateSummary(features.dungeon.domain.core.projection.DungeonState aggregate) {
        return aggregate.label() + " #" + aggregate.id();
    }

    private static features.dungeon.api.DungeonInspectorSnapshot.StatePanelFacts statePanelFacts(
            DungeonAuthoredPublication.StatePanelFacts facts
    ) {
        return new features.dungeon.api.DungeonInspectorSnapshot.StatePanelFacts(
                stairGeometryFacts(facts.stairGeometry()),
                transitionDestinationFacts(facts.transitionDestination()));
    }

    private static features.dungeon.api.DungeonInspectorSnapshot.StairGeometryFacts stairGeometryFacts(
            DungeonAuthoredPublication.StairGeometry facts
    ) {
        return new features.dungeon.api.DungeonInspectorSnapshot.StairGeometryFacts(
                facts.present(),
                facts.stairId(),
                facts.shapeName(),
                facts.directionName(),
                facts.dimension1(),
                facts.dimension2());
    }

    private static features.dungeon.api.DungeonInspectorSnapshot.TransitionDestinationFacts
            transitionDestinationFacts(
                    DungeonAuthoredPublication.TransitionDestination facts
            ) {
        return new features.dungeon.api.DungeonInspectorSnapshot.TransitionDestinationFacts(
                facts.present(),
                facts.destinationTypeKey(),
                facts.mapId(),
                facts.tileId(),
                facts.transitionId());
    }

    private static List<features.dungeon.api.DungeonInspectorSnapshot.RoomNarrationCard> roomNarrations(
            DungeonAuthoredPublication.Inspector snapshot
    ) {
        List<features.dungeon.api.DungeonInspectorSnapshot.RoomNarrationCard> roomNarrations = new ArrayList<>();
        for (DungeonAuthoredPublication.RoomNarration roomNarration : snapshot.roomNarrations()) {
            roomNarrations.add(roomNarration(roomNarration));
        }
        return List.copyOf(roomNarrations);
    }

    private static features.dungeon.api.DungeonInspectorSnapshot.RoomNarrationCard roomNarration(
            DungeonAuthoredPublication.RoomNarration roomNarration
    ) {
        return new features.dungeon.api.DungeonInspectorSnapshot.RoomNarrationCard(
                roomNarration.roomId(),
                roomNarration.roomName(),
                roomNarration.visualDescription(),
                recordPublishedRoomExits(roomNarration.exits()));
    }

    private static List<features.dungeon.api.DungeonInspectorSnapshot.RoomExitNarration>
            recordPublishedRoomExits(List<DungeonAuthoredPublication.RoomExitNarration> exits) {
        List<features.dungeon.api.DungeonInspectorSnapshot.RoomExitNarration> result = new ArrayList<>();
        for (DungeonAuthoredPublication.RoomExitNarration exit : exits) {
            result.add(new features.dungeon.api.DungeonInspectorSnapshot.RoomExitNarration(
                    exit.label(),
                    DungeonPublishedMapProjectionServiceAssembly.cell(exit.cell()),
                    exit.direction().name(),
                    exit.description()));
        }
        return List.copyOf(result);
    }
}
