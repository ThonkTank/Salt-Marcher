package features.dungeon.application.authored.command;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.feature.FeatureMarkerCatalog;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/** Revision-checked stable-entity delta for one authored Dungeon map. */
public record DungeonPatch(
        DungeonMapIdentity mapId,
        long expectedRevision,
        List<DungeonPatchChange> changes,
        Set<DungeonChunkKey> touchedChunks,
        DungeonPatchResultFacts resultFacts,
        long encodedBytes
) {

    public DungeonPatch {
        mapId = Objects.requireNonNull(mapId, "mapId");
        expectedRevision = Math.max(0L, expectedRevision);
        changes = changes == null ? List.of() : List.copyOf(changes);
        if (changes.isEmpty() || changes.stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("a Dungeon patch requires at least one change");
        }
        for (DungeonPatchChange change : changes) {
            if (!mapId.equals(change.mapId())) {
                throw new IllegalArgumentException("every patch change must belong to the patch map");
            }
        }
        Set<DungeonChunkKey> derivedChunks = derivedChunks(changes);
        touchedChunks = touchedChunks == null ? derivedChunks : Set.copyOf(touchedChunks);
        if (!touchedChunks.equals(derivedChunks)) {
            throw new IllegalArgumentException("touched chunks must match the encoded changes");
        }
        DungeonPatchResultFacts derivedFacts = derivedFacts(changes);
        resultFacts = resultFacts == null ? derivedFacts : resultFacts;
        if (!resultFacts.equals(derivedFacts)) {
            throw new IllegalArgumentException("result facts must match the encoded changes");
        }
        long derivedBytes = derivedBytes(changes);
        encodedBytes = encodedBytes <= 0L ? derivedBytes : encodedBytes;
        if (encodedBytes != derivedBytes) {
            throw new IllegalArgumentException("encoded byte weight must match the encoded changes");
        }
    }

    public static DungeonPatch of(
            DungeonMapIdentity mapId,
            long expectedRevision,
            List<DungeonPatchChange> changes
    ) {
        List<DungeonPatchChange> safeChanges = changes == null ? List.of() : List.copyOf(changes);
        return new DungeonPatch(
                mapId,
                expectedRevision,
                safeChanges,
                derivedChunks(safeChanges),
                derivedFacts(safeChanges),
                derivedBytes(safeChanges));
    }

    public long committedRevision() {
        return expectedRevision + 1L;
    }

    public DungeonPatch inverse() {
        return DungeonPatch.of(
                mapId,
                committedRevision(),
                changes.reversed().stream().map(DungeonPatchChange::inverse).toList());
    }

    public DungeonPatch rebased(long nextExpectedRevision) {
        return DungeonPatch.of(mapId, nextExpectedRevision, changes);
    }

    public DungeonMap applyTo(DungeonMap current) {
        DungeonMap safeCurrent = Objects.requireNonNull(current, "current");
        if (!mapId.equals(safeCurrent.metadata().mapId()) || safeCurrent.revision() != expectedRevision) {
            throw new IllegalArgumentException("patch map and expected revision must match current authored truth");
        }
        FeatureMarkerCatalog featureMarkers = safeCurrent.featureMarkers();
        for (DungeonPatchChange change : changes) {
            featureMarkers = switch (change) {
                case FeatureMarkerChange featureMarkerChange -> featureMarkerChange.applyTo(featureMarkers);
            };
        }
        DungeonMap changed = safeCurrent.withFeatureMarkers(featureMarkers);
        if (changed.equals(safeCurrent)) {
            throw new IllegalStateException("accepted patch must change authored truth");
        }
        return DungeonMapAuthoring.committedContent(changed, committedRevision());
    }

    @Override
    public List<DungeonPatchChange> changes() {
        return List.copyOf(changes);
    }

    @Override
    public Set<DungeonChunkKey> touchedChunks() {
        return Set.copyOf(touchedChunks);
    }

    private static Set<DungeonChunkKey> derivedChunks(List<DungeonPatchChange> changes) {
        Set<DungeonChunkKey> result = new LinkedHashSet<>();
        for (DungeonPatchChange change : changes) {
            if (change != null) {
                result.addAll(change.touchedChunks());
            }
        }
        return Set.copyOf(result);
    }

    private static DungeonPatchResultFacts derivedFacts(List<DungeonPatchChange> changes) {
        return new DungeonPatchResultFacts(changes.stream()
                .filter(Objects::nonNull)
                .map(DungeonPatchChange::topologyRef)
                .distinct()
                .toList());
    }

    private static long derivedBytes(List<DungeonPatchChange> changes) {
        return Math.max(1L, changes.stream()
                .filter(Objects::nonNull)
                .mapToLong(DungeonPatchChange::encodedBytes)
                .sum());
    }
}
