package features.dungeon.application.authored.command;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** One atomic authored command spanning one or more revisioned Dungeon maps. */
public record DungeonCompoundPatch(
        List<DungeonPatch> patches,
        Set<DungeonChunkKey> touchedChunks,
        Map<DungeonMapIdentity, DungeonPatchResultFacts> resultFactsByMap,
        long encodedBytes
) {

    public DungeonCompoundPatch {
        patches = patches == null ? List.of() : List.copyOf(patches);
        if (patches.isEmpty() || patches.stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("a compound patch requires at least one map patch");
        }
        Map<DungeonMapIdentity, DungeonPatch> uniquePatches = patchesByMap(patches);
        if (uniquePatches.size() != patches.size()) {
            throw new IllegalArgumentException("a compound patch may contain only one patch per map");
        }
        Set<DungeonChunkKey> derivedChunks = derivedChunks(patches);
        touchedChunks = touchedChunks == null ? derivedChunks : Set.copyOf(touchedChunks);
        if (!touchedChunks.equals(derivedChunks)) {
            throw new IllegalArgumentException("compound touched chunks must match its map patches");
        }
        Map<DungeonMapIdentity, DungeonPatchResultFacts> derivedFacts = derivedFacts(patches);
        resultFactsByMap = resultFactsByMap == null ? derivedFacts : Map.copyOf(resultFactsByMap);
        if (!resultFactsByMap.equals(derivedFacts)) {
            throw new IllegalArgumentException("compound result facts must match its map patches");
        }
        long derivedBytes = derivedBytes(patches);
        encodedBytes = encodedBytes <= 0L ? derivedBytes : encodedBytes;
        if (encodedBytes != derivedBytes) {
            throw new IllegalArgumentException("compound byte weight must match its map patches");
        }
    }

    public static DungeonCompoundPatch of(List<DungeonPatch> patches) {
        List<DungeonPatch> safePatches = patches == null ? List.of() : List.copyOf(patches);
        return new DungeonCompoundPatch(
                safePatches,
                derivedChunks(safePatches),
                derivedFacts(safePatches),
                derivedBytes(safePatches));
    }

    public DungeonCompoundPatch inverse() {
        return of(patches.stream().map(DungeonPatch::inverse).toList());
    }

    public DungeonCompoundPatch rebased(Map<DungeonMapIdentity, Long> expectedRevisions) {
        Map<DungeonMapIdentity, Long> safeRevisions = expectedRevisions == null
                ? Map.of()
                : Map.copyOf(expectedRevisions);
        return of(patches.stream()
                .map(patch -> patch.rebased(requiredRevision(safeRevisions, patch.mapId())))
                .toList());
    }

    public Map<Long, DungeonMap> applyTo(Map<Long, DungeonMap> currentMaps) {
        Map<Long, DungeonMap> safeCurrentMaps = currentMaps == null ? Map.of() : currentMaps;
        Map<Long, DungeonMap> result = new LinkedHashMap<>();
        for (DungeonPatch patch : patches) {
            long mapId = patch.mapId().value();
            DungeonMap current = safeCurrentMaps.get(mapId);
            if (current == null) {
                throw new IllegalArgumentException("compound patch requires every affected map");
            }
            result.put(mapId, patch.applyTo(current));
        }
        return Collections.unmodifiableMap(new LinkedHashMap<>(result));
    }

    @Override
    public List<DungeonPatch> patches() {
        return List.copyOf(patches);
    }

    @Override
    public Set<DungeonChunkKey> touchedChunks() {
        return Set.copyOf(touchedChunks);
    }

    @Override
    public Map<DungeonMapIdentity, DungeonPatchResultFacts> resultFactsByMap() {
        return Map.copyOf(resultFactsByMap);
    }

    private static long requiredRevision(Map<DungeonMapIdentity, Long> revisions, DungeonMapIdentity mapId) {
        Long revision = revisions.get(mapId);
        if (revision == null) {
            throw new IllegalArgumentException("compound rebase requires every affected map revision");
        }
        return revision;
    }

    private static Map<DungeonMapIdentity, DungeonPatch> patchesByMap(List<DungeonPatch> patches) {
        Map<DungeonMapIdentity, DungeonPatch> result = new LinkedHashMap<>();
        for (DungeonPatch patch : patches) {
            if (patch != null) {
                result.put(patch.mapId(), patch);
            }
        }
        return Map.copyOf(result);
    }

    private static Set<DungeonChunkKey> derivedChunks(List<DungeonPatch> patches) {
        Set<DungeonChunkKey> result = new LinkedHashSet<>();
        for (DungeonPatch patch : patches) {
            if (patch != null) {
                result.addAll(patch.touchedChunks());
            }
        }
        return Set.copyOf(result);
    }

    private static Map<DungeonMapIdentity, DungeonPatchResultFacts> derivedFacts(List<DungeonPatch> patches) {
        Map<DungeonMapIdentity, DungeonPatchResultFacts> result = new LinkedHashMap<>();
        for (DungeonPatch patch : patches) {
            if (patch != null) {
                result.put(patch.mapId(), patch.resultFacts());
            }
        }
        return Map.copyOf(result);
    }

    private static long derivedBytes(List<DungeonPatch> patches) {
        return Math.max(1L, patches.stream()
                .filter(Objects::nonNull)
                .mapToLong(DungeonPatch::encodedBytes)
                .sum());
    }
}
