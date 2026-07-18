package features.dungeon.application.authored.command;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.feature.FeatureMarkerCatalog;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/** Exact before/after delta for one authored feature marker. */
public record FeatureMarkerChange(FeatureMarker before, FeatureMarker after) implements DungeonPatchChange {
    private static final long FIXED_ENCODING_BYTES = 96L;

    public FeatureMarkerChange {
        if (before == null && after == null) {
            throw new IllegalArgumentException("a feature marker change requires before or after state");
        }
        if (before != null && after != null) {
            if (before.markerId() != after.markerId()) {
                throw new IllegalArgumentException("feature marker identity must remain stable");
            }
            if (!Objects.equals(before.mapId(), after.mapId())) {
                throw new IllegalArgumentException("feature marker map identity must remain stable");
            }
        }
    }

    @Override
    public DungeonMapIdentity mapId() {
        return state().mapId();
    }

    @Override
    public DungeonTopologyRef topologyRef() {
        return state().topologyRef();
    }

    @Override
    public Set<DungeonChunkKey> touchedChunks() {
        Set<DungeonChunkKey> result = new LinkedHashSet<>();
        addChunk(result, before);
        addChunk(result, after);
        return Set.copyOf(result);
    }

    @Override
    public long encodedBytes() {
        return FIXED_ENCODING_BYTES + encodedTextBytes(before) + encodedTextBytes(after);
    }

    @Override
    public FeatureMarkerChange inverse() {
        return new FeatureMarkerChange(after, before);
    }

    public FeatureMarkerCatalog applyTo(FeatureMarkerCatalog catalog) {
        FeatureMarkerCatalog safeCatalog = Objects.requireNonNull(catalog, "catalog");
        return safeCatalog.withExactChange(before, after);
    }

    private FeatureMarker state() {
        return after == null ? before : after;
    }

    private static void addChunk(Set<DungeonChunkKey> result, FeatureMarker marker) {
        if (marker == null) {
            return;
        }
        Cell anchor = marker.anchor();
        result.add(new DungeonChunkKey(
                marker.mapId().value(),
                anchor.level(),
                Math.floorDiv(anchor.q(), DungeonChunkKey.CHUNK_SIZE),
                Math.floorDiv(anchor.r(), DungeonChunkKey.CHUNK_SIZE)));
    }

    private static long encodedTextBytes(FeatureMarker marker) {
        if (marker == null) {
            return 1L;
        }
        return marker.label().getBytes(StandardCharsets.UTF_8).length
                + marker.description().getBytes(StandardCharsets.UTF_8).length;
    }
}
