package src.domain.dungeon;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository;

final class DungeonAuthoredPublication {

    private DungeonAuthoredPublication() {
    }

    static Snapshot snapshot(
            DungeonAuthoredPublishedStateRepository.@Nullable SnapshotPublication source
    ) {
        return new Snapshot(source);
    }

    static Inspector inspector(DungeonAuthoredPublishedStateRepository.InspectorPublication source) {
        return new Inspector(source);
    }

    static Mutation mutation(DungeonAuthoredPublishedStateRepository.MutationPublication source) {
        return new Mutation(source);
    }

    static Catalog catalog(DungeonAuthoredPublishedStateRepository.CatalogPublication source) {
        return new Catalog(source);
    }

    static MapMutation mapMutation(DungeonAuthoredPublishedStateRepository.MapMutationPublication source) {
        return new MapMutation(source);
    }

    record Snapshot(DungeonAuthoredPublishedStateRepository.@Nullable SnapshotPublication source) {
    }

    record Inspector(DungeonAuthoredPublishedStateRepository.InspectorPublication source) {
        String title() {
            return source.title();
        }

        String description() {
            return source.description();
        }

        List<String> facts() {
            return source.facts();
        }

        StatePanelFacts statePanelFacts() {
            return new StatePanelFacts(source.statePanelFacts());
        }

        List<RoomNarration> roomNarrations() {
            return source.roomNarrations().stream()
                    .map(RoomNarration::new)
                    .toList();
        }
    }

    record StatePanelFacts(DungeonAuthoredPublishedStateRepository.StatePanelFacts source) {
        StairGeometry stairGeometry() {
            return new StairGeometry(source.stairGeometry());
        }

        TransitionDestination transitionDestination() {
            return new TransitionDestination(source.transitionDestination());
        }
    }

    record StairGeometry(DungeonAuthoredPublishedStateRepository.StairGeometryPublication source) {
        boolean present() {
            return source.present();
        }

        long stairId() {
            return source.stairId();
        }

        String shapeName() {
            return source.shapeName();
        }

        String directionName() {
            return source.directionName();
        }

        int dimension1() {
            return source.dimension1();
        }

        int dimension2() {
            return source.dimension2();
        }
    }

    record TransitionDestination(
            DungeonAuthoredPublishedStateRepository.TransitionDestinationPublication source
    ) {
        boolean present() {
            return source.present();
        }

        String destinationTypeKey() {
            return source.destinationTypeKey();
        }

        long mapId() {
            return source.mapId();
        }

        long tileId() {
            return source.tileId();
        }

        long transitionId() {
            return source.transitionId();
        }
    }

    record Mutation(DungeonAuthoredPublishedStateRepository.MutationPublication source) {
    }

    record Catalog(DungeonAuthoredPublishedStateRepository.CatalogPublication source) {
        List<MapSummary> maps() {
            return source == null
                    ? List.of()
                    : source.maps().stream().map(MapSummary::new).toList();
        }
    }

    record MapMutation(DungeonAuthoredPublishedStateRepository.MapMutationPublication source) {
        DungeonMapIdentity mapId() {
            return source.mapId();
        }
    }

    record MapSummary(DungeonAuthoredPublishedStateRepository.MapSummaryPublication source) {
        DungeonMapIdentity mapId() {
            return source.mapId();
        }

        String mapName() {
            return source.mapName();
        }

        long revision() {
            return source.revision();
        }
    }

    record RoomNarration(DungeonAuthoredPublishedStateRepository.RoomNarrationPublication source) {
        long roomId() {
            return source.roomId();
        }

        String roomName() {
            return source.roomName();
        }

        String visualDescription() {
            return source.visualDescription();
        }

        List<RoomExitNarration> exits() {
            return source.exits().stream().map(RoomExitNarration::new).toList();
        }
    }

    record RoomExitNarration(DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication source) {
        String label() {
            return source.label();
        }

        Cell cell() {
            return source.cell();
        }

        Direction direction() {
            return source.direction();
        }

        String description() {
            return source.description();
        }
    }
}
