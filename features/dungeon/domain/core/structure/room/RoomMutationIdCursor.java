package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.structure.room.RoomTopologyWorkCatalog.ReservedIdentities;

final class RoomMutationIdCursor {
    private long nextClusterId;
    private final long clusterLimitExclusive;
    private long nextRoomId;
    private final long roomLimitExclusive;

    RoomMutationIdCursor(ReservedIdentities identities) {
        ReservedIdentities reserved = java.util.Objects.requireNonNull(identities, "identities");
        nextClusterId = reserved.firstClusterId();
        clusterLimitExclusive = reserved.clusterLimitExclusive();
        nextRoomId = reserved.firstRoomId();
        roomLimitExclusive = reserved.roomLimitExclusive();
    }

    long reserveClusterId() {
        requireAvailable(nextClusterId, clusterLimitExclusive, "room-cluster");
        long clusterId = nextClusterId;
        nextClusterId += 1L;
        return clusterId;
    }

    long reserveRoomId() {
        requireAvailable(nextRoomId, roomLimitExclusive, "room");
        long roomId = nextRoomId;
        nextRoomId += 1L;
        return roomId;
    }

    private static void requireAvailable(long candidate, long limitExclusive, String kind) {
        if (candidate >= limitExclusive) {
            throw new IllegalStateException(kind + " identity reservation exhausted");
        }
    }
}
