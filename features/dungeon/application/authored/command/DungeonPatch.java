package features.dungeon.application.authored.command;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
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
        boolean foreignChunk = false;
        for (DungeonChunkKey chunk : touchedChunks) {
            foreignChunk |= chunk.mapId() != mapId.value();
        }
        if (!touchedChunks.containsAll(derivedChunks) || foreignChunk) {
            throw new IllegalArgumentException("touched chunks must contain every direct change chunk for the map");
        }
        DungeonPatchResultFacts derivedFacts = derivedFacts(changes);
        resultFacts = resultFacts == null ? derivedFacts : resultFacts;
        if (!resultFacts.affectedEntities().containsAll(derivedFacts.affectedEntities())) {
            throw new IllegalArgumentException("result facts must contain every directly changed entity");
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
        return new DungeonPatch(
                mapId,
                committedRevision(),
                changes.reversed().stream().map(DungeonPatchChange::inverse).toList(),
                touchedChunks,
                resultFacts,
                encodedBytes);
    }

    public DungeonPatch rebased(long nextExpectedRevision) {
        return new DungeonPatch(
                mapId, nextExpectedRevision, changes, touchedChunks, resultFacts, encodedBytes);
    }

    /** Adds command-planned derived impact without inventing another authored change. */
    public DungeonPatch withImpact(
            Set<DungeonChunkKey> impactedChunks,
            List<DungeonPatchEntityRef> impactedEntities
    ) {
        Set<DungeonChunkKey> chunks = new LinkedHashSet<>(touchedChunks);
        if (impactedChunks != null) {
            chunks.addAll(impactedChunks);
        }
        List<DungeonPatchEntityRef> entities = new java.util.ArrayList<>(resultFacts.affectedEntities());
        if (impactedEntities != null) {
            entities.addAll(impactedEntities);
        }
        return new DungeonPatch(
                mapId,
                expectedRevision,
                changes,
                Set.copyOf(chunks),
                new DungeonPatchResultFacts(entities),
                encodedBytes);
    }

    public DungeonMap applyTo(DungeonMap current) {
        DungeonMap safeCurrent = Objects.requireNonNull(current, "current");
        if (!mapId.equals(safeCurrent.metadata().mapId()) || safeCurrent.revision() != expectedRevision) {
            throw new IllegalArgumentException("patch map and expected revision must match current authored truth");
        }
        DungeonMap changed = safeCurrent;
        for (DungeonPatchChange change : changes) {
            changed = switch (change) {
                case FeatureMarkerChange featureMarkerChange -> changed.withFeatureMarkers(
                        featureMarkerChange.applyTo(changed.featureMarkers()));
                case RoomRegionChange roomRegionChange -> changed.withExactRoomRegionChange(
                        roomRegionChange.before(), roomRegionChange.after());
                case RoomClusterChange roomClusterChange -> changed.withExactRoomClusterChange(
                        roomClusterChange.before(), roomClusterChange.after());
                case StairChange stairChange -> changed.withExactStairChange(
                        stairChange.before(), stairChange.after());
                case TransitionChange transitionChange -> changed.withExactTransitionChange(
                        transitionChange.before(), transitionChange.after());
                case CorridorChange corridorChange -> changed.withExactCorridorChange(
                        corridorChange.before(), corridorChange.after());
            };
        }
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
                .map(DungeonPatchChange::entityRef)
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
