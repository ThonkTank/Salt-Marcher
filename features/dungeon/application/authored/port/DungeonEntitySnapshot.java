package features.dungeon.application.authored.port;

import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.domain.core.structure.transition.Transition;
import java.util.Objects;

/** Typed authored fact for exactly one stable identity; never a partial aggregate. */
public sealed interface DungeonEntitySnapshot permits DungeonEntitySnapshot.Room,
        DungeonEntitySnapshot.RoomClusterSnapshot,
        DungeonEntitySnapshot.CorridorSnapshot,
        DungeonEntitySnapshot.StairSnapshot,
        DungeonEntitySnapshot.TransitionSnapshot,
        DungeonEntitySnapshot.FeatureMarkerSnapshot {

    DungeonPatchEntityRef ref();

    record Room(RoomRegion value) implements DungeonEntitySnapshot {
        public Room {
            value = Objects.requireNonNull(value, "value");
        }

        @Override
        public DungeonPatchEntityRef ref() {
            return DungeonPatchEntityRef.room(value.roomId());
        }
    }

    record RoomClusterSnapshot(RoomCluster value) implements DungeonEntitySnapshot {
        public RoomClusterSnapshot {
            value = Objects.requireNonNull(value, "value");
        }

        @Override
        public DungeonPatchEntityRef ref() {
            return DungeonPatchEntityRef.roomCluster(value.clusterId());
        }
    }

    record CorridorSnapshot(Corridor value) implements DungeonEntitySnapshot {
        public CorridorSnapshot {
            value = Objects.requireNonNull(value, "value");
        }

        @Override
        public DungeonPatchEntityRef ref() {
            return DungeonPatchEntityRef.corridor(value.corridorId());
        }
    }

    record StairSnapshot(Stair value) implements DungeonEntitySnapshot {
        public StairSnapshot {
            value = Objects.requireNonNull(value, "value");
        }

        @Override
        public DungeonPatchEntityRef ref() {
            return DungeonPatchEntityRef.stair(value.stairId());
        }
    }

    record TransitionSnapshot(Transition value) implements DungeonEntitySnapshot {
        public TransitionSnapshot {
            value = Objects.requireNonNull(value, "value");
        }

        @Override
        public DungeonPatchEntityRef ref() {
            return DungeonPatchEntityRef.transition(value.transitionId());
        }
    }

    record FeatureMarkerSnapshot(FeatureMarker value) implements DungeonEntitySnapshot {
        public FeatureMarkerSnapshot {
            value = Objects.requireNonNull(value, "value");
        }

        @Override
        public DungeonPatchEntityRef ref() {
            return DungeonPatchEntityRef.featureMarker(value.markerId());
        }
    }
}
