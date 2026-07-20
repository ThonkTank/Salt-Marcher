package features.dungeon.application.authored;

import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonEntitySnapshot;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonInboundReferenceRequest;
import features.dungeon.application.authored.port.DungeonInboundReferenceResult;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.application.authored.port.DungeonWindowStore;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.jspecify.annotations.Nullable;

/** Catalog-first, revision-bound window and identity-closure orchestration. */
public final class DungeonCommandWorksetLoader {
    private final DungeonCatalogStore catalogStore;
    private final DungeonWindowStore windowStore;
    private final DungeonCommandWorksetAssembler assembler = new DungeonCommandWorksetAssembler();

    public DungeonCommandWorksetLoader(DungeonCatalogStore catalogStore, DungeonWindowStore windowStore) {
        this.catalogStore = Objects.requireNonNull(catalogStore, "catalogStore");
        this.windowStore = Objects.requireNonNull(windowStore, "windowStore");
    }

    public DungeonCommandWorksetResult load(DungeonCommandReadSpec spec) {
        DungeonCommandReadSpec safeSpec = Objects.requireNonNull(spec, "spec");
        DungeonMapHeader catalogHeader = catalogStore.find(safeSpec.mapId()).orElse(null);
        if (catalogHeader == null) {
            return rejected(DungeonCommandWorksetResult.Reason.MAP_MISSING, safeSpec.seedRefs());
        }
        if (catalogHeader.revision() != safeSpec.expectedRevision()) {
            return rejected(DungeonCommandWorksetResult.Reason.STALE_REVISION, safeSpec.seedRefs());
        }

        DungeonWindowRequest windowRequest = new DungeonWindowRequest(
                safeSpec.mapId(), safeSpec.requestGeneration(), safeSpec.chunkKeys());
        DungeonWindow window = windowStore.loadWindow(windowRequest).orElse(null);
        if (window == null) {
            return rejected(DungeonCommandWorksetResult.Reason.MAP_MISSING, safeSpec.seedRefs());
        }
        DungeonCommandWorksetResult invalidWindow = validateWindow(safeSpec, window);
        if (invalidWindow != null) {
            return invalidWindow;
        }

        Set<DungeonPatchEntityRef> required = new LinkedHashSet<>(safeSpec.seedRefs());
        window.fragments().forEach(fragment -> {
            required.add(fragment.entityRef());
            required.addAll(fragment.dependencyHeaders());
        });
        Map<DungeonPatchEntityRef, Integer> requestedExtentCounts = new LinkedHashMap<>();
        window.entityExtents().forEach(extent -> requestedExtentCounts.merge(
                extent.entityRef(), 1, Integer::sum));
        window.entityExtents().stream()
                .filter(extent -> requestedExtentCounts.getOrDefault(extent.entityRef(), 0)
                        < extent.entityChunkCount())
                .forEach(extent -> required.add(extent.entityRef()));

        Map<DungeonPatchEntityRef, DungeonEntitySnapshot> loaded = new LinkedHashMap<>();
        Set<DungeonPatchEntityRef> inboundExpanded = new LinkedHashSet<>();
        boolean revisionValidated = false;
        while (true) {
            List<DungeonPatchEntityRef> pending = orderedDifference(required, loaded.keySet());
            if (!pending.isEmpty() || !revisionValidated) {
                DungeonIdentityClosureResult closure = windowStore.loadIdentityClosure(
                        new DungeonIdentityClosureRequest(
                                safeSpec.mapId(), safeSpec.expectedRevision(), pending));
                revisionValidated = true;
                if (closure instanceof DungeonIdentityClosureResult.Rejected rejected) {
                    return rejected(map(rejected.reason()), rejected.affectedEntities());
                }
                DungeonIdentityClosureResult.Complete complete = (DungeonIdentityClosureResult.Complete) closure;
                if (!sameHeader(catalogHeader, complete.mapHeader())) {
                    return rejected(DungeonCommandWorksetResult.Reason.STALE_REVISION, pending);
                }
                for (DungeonEntitySnapshot snapshot : complete.entities()) {
                    loaded.put(snapshot.ref(), snapshot);
                    required.addAll(snapshot.dependencyHeaders());
                }
            }

            if (safeSpec.dependencyExpansion()
                    == DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND) {
                List<DungeonPatchEntityRef> discoveryTargets = orderedDifference(required, inboundExpanded);
                if (!discoveryTargets.isEmpty()) {
                    DungeonInboundReferenceResult inbound = windowStore.discoverInboundReferences(
                            new DungeonInboundReferenceRequest(
                                    safeSpec.mapId(), safeSpec.expectedRevision(), discoveryTargets));
                    if (inbound instanceof DungeonInboundReferenceResult.Rejected rejected) {
                        return rejected(map(rejected.reason()), rejected.affectedEntities());
                    }
                    DungeonInboundReferenceResult.Complete complete =
                            (DungeonInboundReferenceResult.Complete) inbound;
                    if (!sameHeader(catalogHeader, complete.mapHeader())) {
                        return rejected(DungeonCommandWorksetResult.Reason.STALE_REVISION, discoveryTargets);
                    }
                    inboundExpanded.addAll(discoveryTargets);
                    required.addAll(complete.inboundRefs());
                }
            }

            if (orderedDifference(required, loaded.keySet()).isEmpty()
                    && (safeSpec.dependencyExpansion()
                            != DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND
                        || inboundExpanded.containsAll(required))) {
                break;
            }
        }

        List<DungeonEntitySnapshot> snapshots = new ArrayList<>(loaded.values());
        snapshots.sort((left, right) -> DungeonWindow.ENTITY_ORDER.compare(left.ref(), right.ref()));
        DungeonCommandWorkset workset = assembler.assemble(
                catalogHeader,
                window.chunkHeaders().stream().map(header -> header.key()).toList(),
                snapshots,
                inboundExpanded);
        return workset.containsComplete(safeSpec)
                ? new DungeonCommandWorksetResult.Complete(workset)
                : rejected(DungeonCommandWorksetResult.Reason.INCOMPLETE_ENTITY, List.copyOf(required));
    }

    private static @Nullable DungeonCommandWorksetResult validateWindow(
            DungeonCommandReadSpec spec,
            DungeonWindow window
    ) {
        if (!window.mapHeader().mapId().equals(spec.mapId())) {
            return rejected(DungeonCommandWorksetResult.Reason.MAP_MISSING, spec.seedRefs());
        }
        if (window.mapHeader().revision() != spec.expectedRevision()
                || window.requestGeneration() != spec.requestGeneration()) {
            return rejected(DungeonCommandWorksetResult.Reason.STALE_REVISION, spec.seedRefs());
        }
        List<features.dungeon.api.DungeonChunkKey> returned =
                window.chunkHeaders().stream().map(header -> header.key()).toList();
        return Set.copyOf(returned).equals(Set.copyOf(spec.chunkKeys()))
                ? null
                : rejected(DungeonCommandWorksetResult.Reason.INCOMPLETE_ENTITY, spec.seedRefs());
    }

    private static boolean sameHeader(DungeonMapHeader expected, DungeonMapHeader actual) {
        return expected.mapId().equals(actual.mapId()) && expected.revision() == actual.revision();
    }

    private static List<DungeonPatchEntityRef> orderedDifference(
            Iterable<DungeonPatchEntityRef> candidates,
            Set<DungeonPatchEntityRef> known
    ) {
        Set<DungeonPatchEntityRef> result = new LinkedHashSet<>();
        for (DungeonPatchEntityRef candidate : candidates) {
            if (candidate != null && !known.contains(candidate)) {
                result.add(candidate);
            }
        }
        return result.stream().sorted(DungeonWindow.ENTITY_ORDER).toList();
    }

    private static DungeonCommandWorksetResult.Rejected rejected(
            DungeonCommandWorksetResult.Reason reason,
            List<DungeonPatchEntityRef> refs
    ) {
        return new DungeonCommandWorksetResult.Rejected(reason, refs);
    }

    private static DungeonCommandWorksetResult.Reason map(DungeonIdentityClosureResult.Reason reason) {
        return switch (reason) {
            case MAP_MISSING -> DungeonCommandWorksetResult.Reason.MAP_MISSING;
            case STALE_REVISION -> DungeonCommandWorksetResult.Reason.STALE_REVISION;
            case ENTITY_MISSING -> DungeonCommandWorksetResult.Reason.ENTITY_MISSING;
            case MALFORMED_ENTITY -> DungeonCommandWorksetResult.Reason.MALFORMED_ENTITY;
            case INCOMPLETE_ENTITY -> DungeonCommandWorksetResult.Reason.INCOMPLETE_ENTITY;
        };
    }
}
