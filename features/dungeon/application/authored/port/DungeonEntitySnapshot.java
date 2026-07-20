package features.dungeon.application.authored.port;

import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.domain.core.structure.transition.Transition;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;

/** Typed authored fact for exactly one stable identity; never a partial aggregate. */
public sealed interface DungeonEntitySnapshot permits DungeonEntitySnapshot.Room,
        DungeonEntitySnapshot.RoomClusterSnapshot,
        DungeonEntitySnapshot.CorridorSnapshot,
        DungeonEntitySnapshot.StairSnapshot,
        DungeonEntitySnapshot.TransitionSnapshot,
        DungeonEntitySnapshot.FeatureMarkerSnapshot {

    DungeonPatchEntityRef ref();

    List<DungeonPatchEntityRef> dependencyHeaders();

    record Room(RoomRegion value, List<DungeonPatchEntityRef> dependencyHeaders)
            implements DungeonEntitySnapshot {
        public Room(RoomRegion value) {
            this(value, List.of());
        }

        public Room {
            value = Objects.requireNonNull(value, "value");
            dependencyHeaders = dependencies(dependencyHeaders);
        }

        @Override
        public DungeonPatchEntityRef ref() {
            return DungeonPatchEntityRef.room(value.roomId());
        }
    }

    record RoomClusterSnapshot(RoomCluster value, List<DungeonPatchEntityRef> dependencyHeaders)
            implements DungeonEntitySnapshot {
        public RoomClusterSnapshot(RoomCluster value) {
            this(value, List.of());
        }

        public RoomClusterSnapshot {
            value = Objects.requireNonNull(value, "value");
            dependencyHeaders = dependencies(dependencyHeaders);
        }

        @Override
        public DungeonPatchEntityRef ref() {
            return DungeonPatchEntityRef.roomCluster(value.clusterId());
        }
    }

    record CorridorSnapshot(Corridor value, List<DungeonPatchEntityRef> dependencyHeaders)
            implements DungeonEntitySnapshot {
        public CorridorSnapshot(Corridor value) {
            this(value, List.of());
        }

        public CorridorSnapshot {
            value = Objects.requireNonNull(value, "value");
            dependencyHeaders = dependencies(dependencyHeaders);
        }

        @Override
        public DungeonPatchEntityRef ref() {
            return DungeonPatchEntityRef.corridor(value.corridorId());
        }
    }

    record StairSnapshot(Stair value, List<DungeonPatchEntityRef> dependencyHeaders)
            implements DungeonEntitySnapshot {
        public StairSnapshot(Stair value) {
            this(value, List.of());
        }

        public StairSnapshot {
            value = Objects.requireNonNull(value, "value");
            dependencyHeaders = dependencies(dependencyHeaders);
        }

        @Override
        public DungeonPatchEntityRef ref() {
            return DungeonPatchEntityRef.stair(value.stairId());
        }
    }

    record TransitionSnapshot(Transition value, List<DungeonPatchEntityRef> dependencyHeaders)
            implements DungeonEntitySnapshot {
        public TransitionSnapshot(Transition value) {
            this(value, List.of());
        }

        public TransitionSnapshot {
            value = Objects.requireNonNull(value, "value");
            dependencyHeaders = dependencies(dependencyHeaders);
        }

        @Override
        public DungeonPatchEntityRef ref() {
            return DungeonPatchEntityRef.transition(value.transitionId());
        }
    }

    record FeatureMarkerSnapshot(FeatureMarker value, List<DungeonPatchEntityRef> dependencyHeaders)
            implements DungeonEntitySnapshot {
        public FeatureMarkerSnapshot(FeatureMarker value) {
            this(value, List.of());
        }

        public FeatureMarkerSnapshot {
            value = Objects.requireNonNull(value, "value");
            dependencyHeaders = dependencies(dependencyHeaders);
        }

        @Override
        public DungeonPatchEntityRef ref() {
            return DungeonPatchEntityRef.featureMarker(value.markerId());
        }
    }

    private static List<DungeonPatchEntityRef> dependencies(List<DungeonPatchEntityRef> values) {
        List<DungeonPatchEntityRef> ordered = new ArrayList<>(new LinkedHashSet<>(
                values == null ? List.of() : values));
        ordered.sort(DungeonWindow.ENTITY_ORDER);
        return List.copyOf(ordered);
    }
}
