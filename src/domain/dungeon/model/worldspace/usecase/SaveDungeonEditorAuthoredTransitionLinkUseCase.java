package src.domain.dungeon.model.worldspace.usecase;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.AuthoredTransitionLink;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.TransitionEndpoint;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.TransitionLinkDirectionality;
import src.domain.dungeon.model.core.projection.DungeonDerivedState;
import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.worldspace.DungeonTransition;
import src.domain.dungeon.model.worldspace.DungeonTransitionDestination;
import src.domain.dungeon.model.worldspace.repository.DungeonMapRepository;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;

public final class SaveDungeonEditorAuthoredTransitionLinkUseCase {

    private final DungeonMapRepository repository;
    private final BuildDungeonDerivedStateUseCase deriveState;
    private final AssembleDungeonSnapshotUseCase assembleDungeonSnapshot;
    private final PublishDungeonEditorHandlesUseCase publishDungeonEditorHandles;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;

    public SaveDungeonEditorAuthoredTransitionLinkUseCase(
            DungeonMapRepository repository,
            BuildDungeonDerivedStateUseCase deriveState,
            AssembleDungeonSnapshotUseCase assembleDungeonSnapshot,
            PublishDungeonEditorHandlesUseCase publishDungeonEditorHandles,
            PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.deriveState = Objects.requireNonNull(deriveState, "deriveState");
        this.assembleDungeonSnapshot = Objects.requireNonNull(assembleDungeonSnapshot, "assembleDungeonSnapshot");
        this.publishDungeonEditorHandles = Objects.requireNonNull(
                publishDungeonEditorHandles,
                "publishDungeonEditorHandles");
        this.publishMutationUseCase = Objects.requireNonNull(publishMutationUseCase, "publishMutationUseCase");
    }

    public boolean execute(
            MapId sourceMapId,
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        LoadedTransitionLink loaded = loadTransitionLink(
                sourceMapId,
                sourceTransitionId,
                targetMapId,
                targetTransitionId);
        if (loaded == null) {
            return false;
        }
        Map<Long, DungeonMap> pendingMaps = loadedMaps(loaded.sourceMap(), loaded.targetMap(), loaded.sourceTransition());
        applyAuthoredTransitionLinkToLoadedMaps(
                pendingMaps,
                authoredTransitionLink(
                        loaded.sourceIdentity().value(),
                        loaded.sourceTransition().transitionId(),
                        loaded.targetIdentity().value(),
                        targetTransitionId,
                        bidirectional));
        List<DungeonMap> savedMaps = repository.saveAll(List.copyOf(pendingMaps.values()));
        DungeonMap savedSourceMap = savedSourceMap(savedMaps, loaded.sourceIdentity().value());
        publish(savedSourceMap);
        return true;
    }

    private void publish(DungeonMap sourceMap) {
        DungeonDerivedState derived = deriveState.execute(sourceMap);
        LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot = assembleDungeonSnapshot.execute(
                sourceMap,
                derived,
                publishDungeonEditorHandles.execute(sourceMap));
        publishMutationUseCase.execute(new ApplyDungeonEditorOperationUseCase.OperationResultData(
                snapshot,
                List.of(),
                List.of("transition link saved")));
    }

    private @Nullable LoadedTransitionLink loadTransitionLink(
            MapId sourceMapId,
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId
    ) {
        if (sourceMapId == null || sourceTransitionId <= 0L || targetMapId <= 0L || targetTransitionId <= 0L) {
            return null;
        }
        DungeonMapIdentity sourceIdentity = new DungeonMapIdentity(sourceMapId.value());
        DungeonMapIdentity targetIdentity = new DungeonMapIdentity(targetMapId);
        DungeonMap sourceMap = repository.findById(sourceIdentity).orElse(null);
        DungeonMap targetMap = repository.findById(targetIdentity).orElse(null);
        if (sourceMap == null || targetMap == null) {
            return null;
        }
        DungeonTransition sourceTransition = sourceMap.transitionById(sourceTransitionId);
        DungeonTransition targetTransition = targetMap.transitionById(targetTransitionId);
        if (sourceTransition == null || targetTransition == null) {
            return null;
        }
        return new LoadedTransitionLink(sourceIdentity, targetIdentity, sourceMap, targetMap, sourceTransition);
    }

    private Map<Long, DungeonMap> loadedMaps(
            DungeonMap sourceMap,
            DungeonMap targetMap,
            DungeonTransition sourceTransition
    ) {
        Map<Long, DungeonMap> pendingMaps = new LinkedHashMap<>();
        pendingMaps.put(sourceMap.metadata().mapId().value(), sourceMap);
        pendingMaps.put(targetMap.metadata().mapId().value(), targetMap);
        long previousMapId = previousLinkedMapId(sourceTransition.destination());
        if (previousMapId > 0L && !pendingMaps.containsKey(previousMapId)) {
            Optional<DungeonMap> previousMap = repository.findById(new DungeonMapIdentity(previousMapId));
            if (previousMap.isPresent()) {
                pendingMaps.put(previousMapId, previousMap.orElseThrow());
            }
        }
        return pendingMaps;
    }

    private long previousLinkedMapId(DungeonTransitionDestination previousDestination) {
        return previousDestination.isDungeonMapDestination() && previousDestination.transitionId() != null
                ? previousDestination.mapId()
                : 0L;
    }

    private void applyAuthoredTransitionLinkToLoadedMaps(
            Map<Long, DungeonMap> pendingMaps,
            AuthoredTransitionLink link
    ) {
        for (Map.Entry<Long, DungeonMap> entry : pendingMaps.entrySet()) {
            DungeonMap map = entry.getValue();
            entry.setValue(map.withTransitionConnections(map.connections().withMapLocalAuthoredTransitionLink(link)));
        }
    }

    private static AuthoredTransitionLink authoredTransitionLink(
            long sourceMapId,
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        return new AuthoredTransitionLink(
                new TransitionEndpoint(sourceMapId, sourceTransitionId),
                new TransitionEndpoint(targetMapId, targetTransitionId),
                bidirectional ? TransitionLinkDirectionality.BIDIRECTIONAL : TransitionLinkDirectionality.ONE_WAY);
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
            DungeonMap targetMap,
            DungeonTransition sourceTransition
    ) {
    }
}
