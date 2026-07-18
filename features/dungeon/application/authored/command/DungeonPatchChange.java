package features.dungeon.application.authored.command;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.Set;

/** One stable-identity authored entity delta carried by a Dungeon patch. */
public sealed interface DungeonPatchChange permits FeatureMarkerChange, RoomRegionChange, RoomClusterChange,
        StairChange {

    DungeonMapIdentity mapId();

    DungeonPatchEntityRef entityRef();

    Set<DungeonChunkKey> touchedChunks();

    /** Deterministic upper bound for the encoded change payload. */
    long encodedBytes();

    DungeonPatchChange inverse();
}
