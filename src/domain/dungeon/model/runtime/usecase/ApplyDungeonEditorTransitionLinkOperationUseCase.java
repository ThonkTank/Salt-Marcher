package src.domain.dungeon.model.runtime.usecase;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalLong;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.projection.DungeonDerivedState;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.AuthoredTransitionLinkMap;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.AuthoredTransitionLinkRewrite;
import src.domain.dungeon.model.core.usecase.BuildDungeonDerivedStateUseCase;

public final class ApplyDungeonEditorTransitionLinkOperationUseCase {
    private static final long NO_TRANSITION_ID = 0L;

    private final DungeonMapRepository repository;
    private final BuildDungeonDerivedStateUseCase deriveState;
    private final AssembleDungeonSnapshotUseCase assembleDungeonSnapshot;
    private final PublishDungeonEditorHandlesUseCase publishDungeonEditorHandles;

    public ApplyDungeonEditorTransitionLinkOperationUseCase(
            DungeonMapRepository repository,
            BuildDungeonDerivedStateUseCase deriveState,
            AssembleDungeonSnapshotUseCase assembleDungeonSnapshot,
            PublishDungeonEditorHandlesUseCase publishDungeonEditorHandles
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.deriveState = Objects.requireNonNull(deriveState, "deriveState");
        this.assembleDungeonSnapshot = Objects.requireNonNull(assembleDungeonSnapshot, "assembleDungeonSnapshot");
        this.publishDungeonEditorHandles = Objects.requireNonNull(
                publishDungeonEditorHandles,
                "publishDungeonEditorHandles");
    }

    public ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData execute(
            @Nullable DungeonMapIdentity sourceMapId,
            long sourceTransitionId,
            @Nullable DungeonMapIdentity targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        LoadedTransitionLink loaded = loadTransitionLink(
                sourceMapId,
                sourceTransitionId,
                targetMapId,
                targetTransitionId);
        if (loaded == null) {
            return null;
        }
        Map<Long, DungeonMap> pendingMaps = loadedMaps(
                loaded.sourceMap(),
                loaded.targetMap());
        AuthoredTransitionLinkRewrite rewrite = transitionLinkRewrite(
                pendingMaps,
                loaded.sourceIdentity().value(),
                sourceTransitionId,
                loaded.targetIdentity().value(),
                targetTransitionId,
                bidirectional);
        OptionalLong requestedMapId = rewrite.requestedMapId();
        if (requestedMapId.isPresent()) {
            long mapId = requestedMapId.orElseThrow();
            Optional<DungeonMap> requiredMap = repository.findById(new DungeonMapIdentity(mapId));
            if (requiredMap.isEmpty()) {
                return null;
            }
            pendingMaps.put(mapId, requiredMap.orElseThrow());
            rewrite = transitionLinkRewrite(
                    pendingMaps,
                    loaded.sourceIdentity().value(),
                    sourceTransitionId,
                    loaded.targetIdentity().value(),
                    targetTransitionId,
                    bidirectional);
        }
        if (!rewrite.accepted()) {
            return null;
        }
        applyCatalogUpdates(pendingMaps, rewrite);
        List<DungeonMap> savedMaps = repository.saveAll(List.copyOf(pendingMaps.values()));
        DungeonMap savedSourceMap = savedSourceMap(savedMaps, loaded.sourceIdentity().value());
        return result(savedSourceMap);
    }

    private ApplyDungeonEditorOperationUseCase.OperationResultData result(DungeonMap sourceMap) {
        DungeonDerivedState derived = deriveState.execute(sourceMap);
        LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot = assembleDungeonSnapshot.execute(
                sourceMap,
                derived,
                publishDungeonEditorHandles.execute(sourceMap));
        return new ApplyDungeonEditorOperationUseCase.OperationResultData(
                snapshot,
                true,
                List.of(),
                List.of("transition link saved"));
    }

    private @Nullable LoadedTransitionLink loadTransitionLink(
            @Nullable DungeonMapIdentity sourceMapId,
            long sourceTransitionId,
            @Nullable DungeonMapIdentity targetMapId,
            long targetTransitionId
    ) {
        if (sourceMapId == null || targetMapId == null || sourceTransitionId <= NO_TRANSITION_ID
                || targetTransitionId <= NO_TRANSITION_ID) {
            return null;
        }
        DungeonMap sourceMap = repository.findById(sourceMapId).orElse(null);
        DungeonMap targetMap = repository.findById(targetMapId).orElse(null);
        if (sourceMap == null || targetMap == null) {
            return null;
        }
        return new LoadedTransitionLink(sourceMapId, targetMapId, sourceMap, targetMap);
    }

    private Map<Long, DungeonMap> loadedMaps(
            DungeonMap sourceMap,
            DungeonMap targetMap
    ) {
        Map<Long, DungeonMap> pendingMaps = new LinkedHashMap<>();
        pendingMaps.put(sourceMap.metadata().mapId().value(), sourceMap);
        pendingMaps.put(targetMap.metadata().mapId().value(), targetMap);
        return pendingMaps;
    }

    private AuthoredTransitionLinkRewrite transitionLinkRewrite(
            Map<Long, DungeonMap> pendingMaps,
            long sourceMapId,
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        List<AuthoredTransitionLinkMap> loadedCatalogs = new ArrayList<>();
        for (DungeonMap map : pendingMaps.values()) {
            loadedCatalogs.add(new AuthoredTransitionLinkMap(
                    map.metadata().mapId().value(),
                    map.transitionCatalog()));
        }
        return TransitionCatalog.authoredTransitionLinkRewrite(
                loadedCatalogs,
                sourceMapId,
                sourceTransitionId,
                targetMapId,
                targetTransitionId,
                bidirectional);
    }

    private static void applyCatalogUpdates(
            Map<Long, DungeonMap> pendingMaps,
            AuthoredTransitionLinkRewrite rewrite
    ) {
        for (Map.Entry<Long, DungeonMap> entry : pendingMaps.entrySet()) {
            DungeonMap map = entry.getValue();
            TransitionCatalog nextCatalog = rewrite.catalogFor(entry.getKey(), map.transitionCatalog());
            entry.setValue(map.withTransitionCatalog(nextCatalog));
        }
    }

    private DungeonMap savedSourceMap(List<DungeonMap> savedMaps, long sourceMapId) {
        for (DungeonMap map : savedMaps) {
            if (map.metadata().mapId().value() == sourceMapId) {
                return map;
            }
        }
        throw new IllegalStateException("Atomic transition link save did not return the source map.");
    }

    private record LoadedTransitionLink(
            DungeonMapIdentity sourceIdentity,
            DungeonMapIdentity targetIdentity,
            DungeonMap sourceMap,
            DungeonMap targetMap
    ) {
    }
}
