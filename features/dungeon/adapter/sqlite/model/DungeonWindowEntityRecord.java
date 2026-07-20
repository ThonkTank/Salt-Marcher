package features.dungeon.adapter.sqlite.model;

import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import java.util.List;

/** Source-local exact entity graphs used only by the sparse window adapter. */
public sealed interface DungeonWindowEntityRecord permits DungeonWindowEntityRecord.Room,
        DungeonWindowEntityRecord.RoomCluster,
        DungeonWindowEntityRecord.Corridor,
        DungeonWindowEntityRecord.Stair,
        DungeonWindowEntityRecord.Transition,
        DungeonWindowEntityRecord.FeatureMarker {

    DungeonPatchEntityRef ref();

    record Room(DungeonRoomRecord value) implements DungeonWindowEntityRecord {
        @Override
        public DungeonPatchEntityRef ref() {
            return DungeonPatchEntityRef.room(value.roomId());
        }
    }

    record RoomCluster(
            DungeonRoomClusterRecord value,
            List<DungeonRoomRecord> memberRooms
    ) implements DungeonWindowEntityRecord {
        public RoomCluster {
            memberRooms = memberRooms == null ? List.of() : List.copyOf(memberRooms);
        }

        @Override
        public DungeonPatchEntityRef ref() {
            return DungeonPatchEntityRef.roomCluster(value.clusterId());
        }
    }

    record Corridor(
            DungeonCorridorRecord value,
            List<DungeonCorridorRecord> anchorHosts
    ) implements DungeonWindowEntityRecord {
        public Corridor {
            anchorHosts = anchorHosts == null ? List.of() : List.copyOf(anchorHosts);
        }

        @Override
        public DungeonPatchEntityRef ref() {
            return DungeonPatchEntityRef.corridor(value.corridorId());
        }
    }

    record Stair(DungeonStairRecord value, boolean boundCorridorPresent)
            implements DungeonWindowEntityRecord {
        @Override
        public DungeonPatchEntityRef ref() {
            return DungeonPatchEntityRef.stair(value.stairId());
        }
    }

    record Transition(DungeonTransitionRecord value) implements DungeonWindowEntityRecord {
        @Override
        public DungeonPatchEntityRef ref() {
            return DungeonPatchEntityRef.transition(value.transitionId());
        }
    }

    record FeatureMarker(DungeonFeatureMarkerRecord value) implements DungeonWindowEntityRecord {
        @Override
        public DungeonPatchEntityRef ref() {
            return DungeonPatchEntityRef.featureMarker(value.markerId());
        }
    }
}
