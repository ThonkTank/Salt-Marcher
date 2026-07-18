package features.dungeon.application.authored.command;

import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import org.jspecify.annotations.Nullable;

/** Stable authored entity identity carried by patch result facts. */
public record DungeonPatchEntityRef(
        Kind kind,
        long id,
        @Nullable DungeonTopologyRef topologyRef
) {

    public DungeonPatchEntityRef {
        if (kind == null || id <= 0L) {
            throw new IllegalArgumentException("patch entity identity must be present");
        }
        DungeonTopologyElementKind expectedTopologyKind = switch (kind) {
            case ROOM -> DungeonTopologyElementKind.ROOM;
            case FEATURE_MARKER -> DungeonTopologyElementKind.FEATURE_MARKER;
            case STAIR -> DungeonTopologyElementKind.STAIR;
            case TRANSITION -> DungeonTopologyElementKind.TRANSITION;
            case ROOM_CLUSTER -> null;
        };
        if (expectedTopologyKind == null && topologyRef != null) {
            throw new IllegalArgumentException("room cluster identity must not invent a topology ref");
        }
        if (expectedTopologyKind != null
                && (topologyRef == null
                        || topologyRef.kind() != expectedTopologyKind
                        || topologyRef.id() != id)) {
            throw new IllegalArgumentException("topology ref must identify the same patch entity");
        }
    }

    public static DungeonPatchEntityRef room(long roomId) {
        return new DungeonPatchEntityRef(
                Kind.ROOM,
                roomId,
                new DungeonTopologyRef(DungeonTopologyElementKind.ROOM, roomId));
    }

    public static DungeonPatchEntityRef roomCluster(long clusterId) {
        return new DungeonPatchEntityRef(Kind.ROOM_CLUSTER, clusterId, null);
    }

    public static DungeonPatchEntityRef featureMarker(long markerId) {
        return new DungeonPatchEntityRef(
                Kind.FEATURE_MARKER,
                markerId,
                new DungeonTopologyRef(DungeonTopologyElementKind.FEATURE_MARKER, markerId));
    }

    public static DungeonPatchEntityRef stair(long stairId) {
        return new DungeonPatchEntityRef(
                Kind.STAIR,
                stairId,
                new DungeonTopologyRef(DungeonTopologyElementKind.STAIR, stairId));
    }

    public static DungeonPatchEntityRef transition(long transitionId) {
        return new DungeonPatchEntityRef(
                Kind.TRANSITION,
                transitionId,
                new DungeonTopologyRef(DungeonTopologyElementKind.TRANSITION, transitionId));
    }

    public enum Kind {
        ROOM,
        ROOM_CLUSTER,
        FEATURE_MARKER,
        STAIR,
        TRANSITION
    }
}
