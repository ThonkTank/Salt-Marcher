package src.domain.dungeon;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.projection.DungeonDerivedState;
import src.domain.dungeon.model.core.projection.DungeonDerivedStateProjection;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapAuthoring;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.corridor.CorridorDeletionTarget;
import src.domain.dungeon.model.core.structure.feature.FeatureMarkerKind;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.stair.StairGeometrySpec;
import src.domain.dungeon.model.core.structure.transition.TransitionAnchor;
import src.domain.dungeon.model.core.structure.transition.TransitionDestination;
import src.domain.dungeon.model.core.usecase.ApplyDungeonMapCatalogUseCase;
import src.domain.dungeon.model.core.usecase.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.model.core.usecase.CreateDungeonMapUseCase;
import src.domain.dungeon.model.core.usecase.DeleteDungeonMapUseCase;
import src.domain.dungeon.model.core.usecase.LoadDungeonMapUseCase;
import src.domain.dungeon.model.core.usecase.RenameDungeonMapUseCase;
import src.domain.dungeon.model.core.usecase.SearchDungeonMapsUseCase;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonAuthoredMutationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorAuthoredOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCorridorMutationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorHandleMutationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorHandleOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorTransitionLinkOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonRoomWallMutationUseCase;
import src.domain.dungeon.model.runtime.usecase.AssembleDungeonSnapshotUseCase;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorSnapshotUseCase;
import src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorAuthoredFeatureMarkerUseCase;
import src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorAuthoredStairUseCase;
import src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorAuthoredTransitionUseCase;
import src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorMapCatalogUseCase;
import src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorAuthoredFeatureMarkerUseCase;
import src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorAuthoredStairUseCase;
import src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorAuthoredTransitionUseCase;
import src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorMapCatalogUseCase;
import src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.InspectDungeonSelectionUseCase;
import src.domain.dungeon.model.runtime.usecase.LoadDungeonEditorAuthoredMapUseCase;
import src.domain.dungeon.model.runtime.usecase.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.model.runtime.usecase.PreviewDungeonEditorAuthoredOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorAuthoredInspectorUseCase;
import src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorAuthoredMutationUseCase;
import src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorAuthoredSnapshotUseCase;
import src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorHandlesUseCase;
import src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorSnapshotUseCase;
import src.domain.dungeon.model.runtime.usecase.RenameDungeonEditorMapCatalogUseCase;
import src.domain.dungeon.model.runtime.usecase.RenameDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredLabelNameUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredRoomNarrationUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredStairGeometryUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredTransitionDescriptionUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredTransitionLinkUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorLabelNameUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorRoomNarrationUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorStairGeometryUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorTransitionDescriptionUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorTransitionLinkUseCase;
import src.domain.dungeon.model.runtime.usecase.SearchDungeonEditorMapCatalogUseCase;
import src.domain.dungeon.model.runtime.usecase.SelectDungeonEditorMapUseCase;

@SuppressWarnings({"PMD.CouplingBetweenObjects", "PMD.ExcessiveImports", "PMD.TooManyMethods"})
public final class DungeonAuthoredApplicationService {
    private final DungeonMapRepository repository;
    private final DungeonAuthoredPublishedState publishedState;
    private final DungeonDerivedStateProjection derivedStateProjection = new DungeonDerivedStateProjection();

    DungeonAuthoredApplicationService(
            DungeonMapRepository repository,
            DungeonAuthoredPublishedState publishedState
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedState = Objects.requireNonNull(publishedState, "publishedState");
    }

    public Session openSession(DungeonEditorDungeonState dungeonState) {
        DungeonEditorDungeonState safeDungeonState =
                Objects.requireNonNull(dungeonState, "dungeonState");
        ApplyDungeonMapCatalogUseCase catalogUseCase = mapCatalogUseCase();
        LoadDungeonSnapshotUseCase loadSnapshotUseCase = loadDungeonSnapshotUseCase();
        SnapshotParts snapshotParts = snapshotParts();
        ApplyDungeonEditorOperationUseCase operationUseCase = authoredOperationUseCase(snapshotParts);
        ApplyDungeonAuthoredMutationUseCase mutationUseCase =
                new ApplyDungeonAuthoredMutationUseCase(operationUseCase);
        ApplyDungeonEditorCorridorMutationUseCase corridorMutationUseCase =
                new ApplyDungeonEditorCorridorMutationUseCase(operationUseCase, repository);
        ApplyDungeonRoomWallMutationUseCase roomWallMutationUseCase =
                new ApplyDungeonRoomWallMutationUseCase(operationUseCase);
        ApplyDungeonEditorHandleMutationUseCase handleMutationUseCase =
                new ApplyDungeonEditorHandleMutationUseCase(operationUseCase);
        PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase =
                new PublishDungeonEditorAuthoredMutationUseCase(publishedState, safeDungeonState);
        ApplyDungeonEditorHandleOperationUseCase handleOperationUseCase =
                new ApplyDungeonEditorHandleOperationUseCase(handleMutationUseCase, publishMutationUseCase);
        return new Session(
                new SearchDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, safeDungeonState),
                new CreateDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, safeDungeonState),
                new RenameDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, safeDungeonState),
                new DeleteDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, safeDungeonState),
                new LoadDungeonEditorAuthoredMapUseCase(
                        loadSnapshotUseCase,
                        new PublishDungeonEditorAuthoredSnapshotUseCase(publishedState, safeDungeonState),
                        new PublishDungeonEditorAuthoredInspectorUseCase(publishedState, safeDungeonState)),
                new PreviewDungeonEditorAuthoredOperationUseCase(
                        operationUseCase,
                        mutationUseCase,
                        corridorMutationUseCase,
                        roomWallMutationUseCase,
                        safeDungeonState),
                new ApplyDungeonEditorAuthoredOperationUseCase(
                        mutationUseCase,
                        corridorMutationUseCase,
                        roomWallMutationUseCase,
                        publishMutationUseCase),
                handleOperationUseCase,
                new SaveDungeonEditorAuthoredRoomNarrationUseCase(mutationUseCase, publishMutationUseCase),
                new SaveDungeonEditorAuthoredLabelNameUseCase(mutationUseCase, publishMutationUseCase),
                new SaveDungeonEditorAuthoredTransitionDescriptionUseCase(operationUseCase, publishMutationUseCase),
                new SaveDungeonEditorAuthoredTransitionLinkUseCase(
                        new ApplyDungeonEditorTransitionLinkOperationUseCase(
                                repository,
                                snapshotParts.derive(),
                                snapshotParts.assembleDungeonSnapshotUseCase(),
                                snapshotParts.publishDungeonEditorHandlesUseCase()),
                        publishMutationUseCase),
                new SaveDungeonEditorAuthoredStairGeometryUseCase(
                        operationUseCase,
                        snapshotParts.loadDungeonMapUseCase(),
                        publishMutationUseCase),
                new CreateDungeonEditorAuthoredStairUseCase(
                        operationUseCase,
                        snapshotParts.loadDungeonMapUseCase(),
                        publishMutationUseCase,
                        repository),
                new CreateDungeonEditorAuthoredTransitionUseCase(
                        operationUseCase,
                        snapshotParts.loadDungeonMapUseCase(),
                        publishMutationUseCase,
                        repository),
                new CreateDungeonEditorAuthoredFeatureMarkerUseCase(
                        operationUseCase,
                        snapshotParts.loadDungeonMapUseCase(),
                        publishMutationUseCase),
                new DeleteDungeonEditorAuthoredStairUseCase(
                        snapshotParts.loadDungeonMapUseCase(),
                        operationUseCase,
                        publishMutationUseCase),
                new DeleteDungeonEditorAuthoredTransitionUseCase(
                        snapshotParts.loadDungeonMapUseCase(),
                        operationUseCase,
                        publishMutationUseCase),
                new DeleteDungeonEditorAuthoredFeatureMarkerUseCase(
                        snapshotParts.loadDungeonMapUseCase(),
                        operationUseCase,
                        publishMutationUseCase));
    }

    public DungeonMap loadMap(@Nullable DungeonMapIdentity mapId) {
        if (mapId != null) {
            Optional<DungeonMap> map = repository.findById(mapId);
            if (map.isPresent()) {
                return map.get();
            }
        }
        return repository.firstMap().orElse(emptyFallbackMap());
    }

    public Optional<DungeonMap> findMap(DungeonMapIdentity mapId) {
        return repository.findById(mapId);
    }

    public DungeonDerivedState derive(DungeonMap dungeonMap) {
        return derivedStateProjection.project(dungeonMap);
    }

    private static DungeonMap emptyFallbackMap() {
        return DungeonMapAuthoring.empty(new DungeonMapIdentity(1L), "Dungeon Map");
    }

    private ApplyDungeonMapCatalogUseCase mapCatalogUseCase() {
        return new ApplyDungeonMapCatalogUseCase(
                new SearchDungeonMapsUseCase(repository),
                new CreateDungeonMapUseCase(repository),
                new RenameDungeonMapUseCase(repository),
                new DeleteDungeonMapUseCase(repository));
    }

    private LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase() {
        SnapshotParts parts = snapshotParts();
        InspectDungeonSelectionUseCase inspectDungeonSelectionUseCase =
                new InspectDungeonSelectionUseCase();
        return new LoadDungeonSnapshotUseCase(
                this::loadMap,
                parts.assembleDungeonSnapshotUseCase(),
                parts.publishDungeonEditorHandlesUseCase(),
                inspectDungeonSelectionUseCase);
    }

    private ApplyDungeonEditorOperationUseCase authoredOperationUseCase(SnapshotParts parts) {
        return new ApplyDungeonEditorOperationUseCase(
                parts.loadDungeonMapUseCase(),
                repository,
                parts.derive(),
                parts.assembleDungeonSnapshotUseCase(),
                parts.publishDungeonEditorHandlesUseCase());
    }

    private SnapshotParts snapshotParts() {
        return new SnapshotParts(
                new LoadDungeonMapUseCase(repository),
                new PublishDungeonEditorHandlesUseCase(),
                new BuildDungeonDerivedStateUseCase(),
                new AssembleDungeonSnapshotUseCase());
    }

    public record RoomNarrationInput(
            long roomId,
            String visualDescription,
            List<RoomNarrationExitInput> exits
    ) {
        public RoomNarrationInput {
            roomId = Math.max(0L, roomId);
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = safeExits(exits);
        }

        @Override
        public List<RoomNarrationExitInput> exits() {
            return List.copyOf(exits);
        }

        private static List<RoomNarrationExitInput> safeExits(List<RoomNarrationExitInput> exits) {
            if (exits == null || exits.isEmpty()) {
                return List.of();
            }
            return exits.stream()
                    .map(exit -> exit == null ? RoomNarrationExitInput.empty() : exit)
                    .toList();
        }
    }

    public record RoomNarrationExitInput(
            String label,
            int q,
            int r,
            int level,
            String direction,
            String description
    ) {
        public RoomNarrationExitInput {
            label = label == null ? "" : label;
            direction = direction == null ? "" : direction;
            description = description == null ? "" : description;
        }

        static RoomNarrationExitInput empty() {
            return new RoomNarrationExitInput("", 0, 0, 0, "", "");
        }
    }

    public record LabelNameInput(LabelTargetKind targetType, long targetId, String name) {
        public LabelNameInput {
            targetType = targetType == null ? LabelTargetKind.EMPTY : targetType;
            targetId = Math.max(0L, targetId);
            name = name == null ? "" : name.trim();
            if (targetType == LabelTargetKind.EMPTY || targetId == 0L) {
                targetType = LabelTargetKind.EMPTY;
                targetId = 0L;
            }
        }
    }

    public enum LabelTargetKind {
        EMPTY,
        ROOM,
        CLUSTER
    }

    public record TransitionLinkInput(
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        public TransitionLinkInput {
            sourceTransitionId = Math.max(0L, sourceTransitionId);
            targetMapId = Math.max(0L, targetMapId);
            targetTransitionId = Math.max(0L, targetTransitionId);
        }
    }

    public record OperationResult(boolean present) {
        public static OperationResult fromNullable(Object result) {
            return new OperationResult(result != null);
        }
    }

    public record TransitionDescriptionInput(long transitionId, String description) {
        public TransitionDescriptionInput {
            transitionId = Math.max(0L, transitionId);
            description = description == null ? "" : description;
        }
    }

    public record StairGeometryInput(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        public StairGeometryInput {
            stairId = Math.max(0L, stairId);
            shapeName = shapeName == null ? "" : shapeName.trim().toUpperCase(Locale.ROOT);
            directionName = directionName == null ? "" : directionName.trim().toUpperCase(Locale.ROOT);
            dimension1 = Math.max(0, dimension1);
            dimension2 = Math.max(0, dimension2);
        }
    }

    public static final class RuntimeCommands {
        private final SelectDungeonEditorMapUseCase selectMapUseCase;
        private final CreateDungeonEditorMapUseCase createMapUseCase;
        private final RenameDungeonEditorMapUseCase renameMapUseCase;
        private final DeleteDungeonEditorMapUseCase deleteMapUseCase;
        private final SaveDungeonEditorRoomNarrationUseCase saveRoomNarrationUseCase;
        private final SaveDungeonEditorLabelNameUseCase saveLabelNameUseCase;
        private final SaveDungeonEditorTransitionDescriptionUseCase saveTransitionDescriptionUseCase;
        private final SaveDungeonEditorTransitionLinkUseCase saveTransitionLinkUseCase;
        private final SaveDungeonEditorStairGeometryUseCase saveStairGeometryUseCase;

        private RuntimeCommands(
                Session session,
                DungeonEditorDungeonState dungeonState,
                DungeonEditorSessionWorkflow workflow,
                BuildDungeonEditorSnapshotUseCase snapshotBuilder,
                PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase,
                ApplyDungeonEditorSessionEffectUseCase effectUseCase
        ) {
            selectMapUseCase = new SelectDungeonEditorMapUseCase(
                    workflow,
                    snapshotBuilder,
                    snapshotPublicationUseCase);
            createMapUseCase = new CreateDungeonEditorMapUseCase(
                    workflow,
                    session.createMapUseCase(),
                    dungeonState,
                    snapshotBuilder,
                    snapshotPublicationUseCase);
            renameMapUseCase = new RenameDungeonEditorMapUseCase(
                    workflow,
                    session.renameMapUseCase(),
                    dungeonState,
                    snapshotBuilder,
                    snapshotPublicationUseCase);
            deleteMapUseCase = new DeleteDungeonEditorMapUseCase(
                    workflow,
                    session.deleteMapUseCase(),
                    snapshotBuilder,
                    snapshotPublicationUseCase);
            saveRoomNarrationUseCase = new SaveDungeonEditorRoomNarrationUseCase(
                    workflow,
                    session.saveRoomNarrationUseCase(),
                    effectUseCase);
            saveLabelNameUseCase = new SaveDungeonEditorLabelNameUseCase(
                    workflow,
                    session.saveLabelNameUseCase(),
                    effectUseCase);
            saveTransitionDescriptionUseCase = new SaveDungeonEditorTransitionDescriptionUseCase(
                    workflow,
                    session.saveTransitionDescriptionUseCase(),
                    effectUseCase);
            saveTransitionLinkUseCase = new SaveDungeonEditorTransitionLinkUseCase(
                    workflow,
                    session.saveTransitionLinkUseCase(),
                    effectUseCase);
            saveStairGeometryUseCase = new SaveDungeonEditorStairGeometryUseCase(
                    workflow,
                    session.saveStairGeometryUseCase(),
                    effectUseCase);
        }

        public DungeonEditorSessionSnapshot.SnapshotData selectMap(long mapId) {
            return selectMapUseCase.execute(mapId);
        }

        public DungeonEditorSessionSnapshot.SnapshotData createMap(String mapName) {
            return createMapUseCase.execute(mapName);
        }

        public DungeonEditorSessionSnapshot.SnapshotData renameMap(long mapId, String mapName) {
            return renameMapUseCase.execute(mapId, mapName);
        }

        public DungeonEditorSessionSnapshot.SnapshotData deleteMap(long mapId) {
            return deleteMapUseCase.execute(mapId);
        }

        public DungeonEditorSessionSnapshot.@Nullable SnapshotData saveRoomNarration(RoomNarrationInput input) {
            RoomNarrationInput safeInput = input == null ? new RoomNarrationInput(0L, "", List.of()) : input;
            return saveRoomNarrationUseCase.execute(new SaveDungeonEditorRoomNarrationUseCase.RoomNarrationInput(
                    safeInput.roomId(),
                    safeInput.visualDescription(),
                    exitInputs(safeInput)));
        }

        public DungeonEditorSessionSnapshot.@Nullable SnapshotData saveLabelName(LabelNameInput input) {
            LabelNameInput safeInput = input == null
                    ? new LabelNameInput(LabelTargetKind.EMPTY, 0L, "")
                    : input;
            return saveLabelNameUseCase.execute(new SaveDungeonEditorLabelNameUseCase.LabelNameInput(
                    targetKind(safeInput.targetType()),
                    safeInput.targetId(),
                    safeInput.name()));
        }

        public DungeonEditorSessionSnapshot.@Nullable SnapshotData saveTransitionDescription(
                TransitionDescriptionInput input
        ) {
            TransitionDescriptionInput safeInput = input == null
                    ? new TransitionDescriptionInput(0L, "")
                    : input;
            return saveTransitionDescriptionUseCase.execute(
                    new SaveDungeonEditorTransitionDescriptionUseCase.TransitionDescriptionInput(
                            safeInput.transitionId(),
                            safeInput.description()));
        }

        public OperationResult saveTransitionLink(TransitionLinkInput input) {
            TransitionLinkInput safeInput = input == null
                    ? new TransitionLinkInput(0L, 0L, 0L, false)
                    : input;
            return OperationResult.fromNullable(saveTransitionLinkUseCase.execute(
                    new SaveDungeonEditorTransitionLinkUseCase.TransitionLinkInput(
                            safeInput.sourceTransitionId(),
                            safeInput.targetMapId(),
                            safeInput.targetTransitionId(),
                            safeInput.bidirectional())));
        }

        public DungeonEditorSessionSnapshot.@Nullable SnapshotData saveStairGeometry(StairGeometryInput input) {
            StairGeometryInput safeInput = input == null
                    ? new StairGeometryInput(0L, "", "", 0, 0)
                    : input;
            return saveStairGeometryUseCase.execute(new SaveDungeonEditorStairGeometryUseCase.StairGeometryInput(
                    safeInput.stairId(),
                    safeInput.shapeName(),
                    safeInput.directionName(),
                    safeInput.dimension1(),
                    safeInput.dimension2()));
        }

        private static List<SaveDungeonEditorRoomNarrationUseCase.ExitInput> exitInputs(RoomNarrationInput input) {
            return input.exits().stream()
                    .map(RuntimeCommands::exitInput)
                    .toList();
        }

        private static SaveDungeonEditorRoomNarrationUseCase.ExitInput exitInput(
                RoomNarrationExitInput exit
        ) {
            return new SaveDungeonEditorRoomNarrationUseCase.ExitInput(
                    exit.label(),
                    exit.q(),
                    exit.r(),
                    exit.level(),
                    exit.direction(),
                    exit.description());
        }

        private static SaveDungeonEditorLabelNameUseCase.TargetKind targetKind(LabelTargetKind targetKind) {
            return switch (targetKind == null ? LabelTargetKind.EMPTY : targetKind) {
                case EMPTY -> SaveDungeonEditorLabelNameUseCase.TargetKind.EMPTY;
                case ROOM -> SaveDungeonEditorLabelNameUseCase.TargetKind.ROOM;
                case CLUSTER -> SaveDungeonEditorLabelNameUseCase.TargetKind.CLUSTER;
            };
        }
    }

    public static final class Session {
        private final SearchDungeonEditorMapCatalogUseCase searchMapsUseCase;
        private final CreateDungeonEditorMapCatalogUseCase createMapUseCase;
        private final RenameDungeonEditorMapCatalogUseCase renameMapUseCase;
        private final DeleteDungeonEditorMapCatalogUseCase deleteMapUseCase;
        private final LoadDungeonEditorAuthoredMapUseCase loadMapUseCase;
        private final PreviewDungeonEditorAuthoredOperationUseCase previewOperationUseCase;
        private final ApplyDungeonEditorAuthoredOperationUseCase applyOperationUseCase;
        private final ApplyDungeonEditorHandleOperationUseCase handleOperationUseCase;
        private final SaveDungeonEditorAuthoredRoomNarrationUseCase saveRoomNarrationUseCase;
        private final SaveDungeonEditorAuthoredLabelNameUseCase saveLabelNameUseCase;
        private final SaveDungeonEditorAuthoredTransitionDescriptionUseCase saveTransitionDescriptionUseCase;
        private final SaveDungeonEditorAuthoredTransitionLinkUseCase saveTransitionLinkUseCase;
        private final SaveDungeonEditorAuthoredStairGeometryUseCase saveStairGeometryUseCase;
        private final CreateDungeonEditorAuthoredStairUseCase createStairUseCase;
        private final CreateDungeonEditorAuthoredTransitionUseCase createTransitionUseCase;
        private final CreateDungeonEditorAuthoredFeatureMarkerUseCase createFeatureMarkerUseCase;
        private final DeleteDungeonEditorAuthoredStairUseCase deleteStairUseCase;
        private final DeleteDungeonEditorAuthoredTransitionUseCase deleteTransitionUseCase;
        private final DeleteDungeonEditorAuthoredFeatureMarkerUseCase deleteFeatureMarkerUseCase;

        private Session(
                SearchDungeonEditorMapCatalogUseCase searchMapsUseCase,
                CreateDungeonEditorMapCatalogUseCase createMapUseCase,
                RenameDungeonEditorMapCatalogUseCase renameMapUseCase,
                DeleteDungeonEditorMapCatalogUseCase deleteMapUseCase,
                LoadDungeonEditorAuthoredMapUseCase loadMapUseCase,
                PreviewDungeonEditorAuthoredOperationUseCase previewOperationUseCase,
                ApplyDungeonEditorAuthoredOperationUseCase applyOperationUseCase,
                ApplyDungeonEditorHandleOperationUseCase handleOperationUseCase,
                SaveDungeonEditorAuthoredRoomNarrationUseCase saveRoomNarrationUseCase,
                SaveDungeonEditorAuthoredLabelNameUseCase saveLabelNameUseCase,
                SaveDungeonEditorAuthoredTransitionDescriptionUseCase saveTransitionDescriptionUseCase,
                SaveDungeonEditorAuthoredTransitionLinkUseCase saveTransitionLinkUseCase,
                SaveDungeonEditorAuthoredStairGeometryUseCase saveStairGeometryUseCase,
                CreateDungeonEditorAuthoredStairUseCase createStairUseCase,
                CreateDungeonEditorAuthoredTransitionUseCase createTransitionUseCase,
                CreateDungeonEditorAuthoredFeatureMarkerUseCase createFeatureMarkerUseCase,
                DeleteDungeonEditorAuthoredStairUseCase deleteStairUseCase,
                DeleteDungeonEditorAuthoredTransitionUseCase deleteTransitionUseCase,
                DeleteDungeonEditorAuthoredFeatureMarkerUseCase deleteFeatureMarkerUseCase
        ) {
            this.searchMapsUseCase = searchMapsUseCase;
            this.createMapUseCase = createMapUseCase;
            this.renameMapUseCase = renameMapUseCase;
            this.deleteMapUseCase = deleteMapUseCase;
            this.loadMapUseCase = loadMapUseCase;
            this.previewOperationUseCase = previewOperationUseCase;
            this.applyOperationUseCase = applyOperationUseCase;
            this.handleOperationUseCase = handleOperationUseCase;
            this.saveRoomNarrationUseCase = saveRoomNarrationUseCase;
            this.saveLabelNameUseCase = saveLabelNameUseCase;
            this.saveTransitionDescriptionUseCase = saveTransitionDescriptionUseCase;
            this.saveTransitionLinkUseCase = saveTransitionLinkUseCase;
            this.saveStairGeometryUseCase = saveStairGeometryUseCase;
            this.createStairUseCase = createStairUseCase;
            this.createTransitionUseCase = createTransitionUseCase;
            this.createFeatureMarkerUseCase = createFeatureMarkerUseCase;
            this.deleteStairUseCase = deleteStairUseCase;
            this.deleteTransitionUseCase = deleteTransitionUseCase;
            this.deleteFeatureMarkerUseCase = deleteFeatureMarkerUseCase;
        }

        public RuntimeCommands runtimeCommands(
                DungeonEditorDungeonState dungeonState,
                DungeonEditorSessionWorkflow workflow,
                BuildDungeonEditorSnapshotUseCase snapshotBuilder,
                PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase,
                ApplyDungeonEditorSessionEffectUseCase effectUseCase
        ) {
            return new RuntimeCommands(
                    this,
                    dungeonState,
                    workflow,
                    snapshotBuilder,
                    snapshotPublicationUseCase,
                    effectUseCase);
        }

        public void searchMaps(String query) {
            searchMapsUseCase.execute(query);
        }

        public void loadMap(MapId mapId) {
            loadMapUseCase.execute(mapId);
        }

        public void loadMapWithSelection(
                MapId mapId,
                src.domain.dungeon.model.core.graph.DungeonTopologyRef topologyRef,
                long clusterId,
                boolean clusterSelection
        ) {
            loadMapUseCase.executeWithSelection(mapId, topologyRef, clusterId, clusterSelection);
        }

        public boolean executeAuthoredDragPreview(MapId mapId, DungeonEditorSessionValues.Preview preview) {
            return previewOperationUseCase.executeAuthoredDragPreview(mapId, preview);
        }

        public void executeInMemoryPreview(
                DungeonEditorSessionSnapshot.SurfaceData surface,
                DungeonEditorSessionValues.Preview preview
        ) {
            previewOperationUseCase.executeInMemory(surface, preview);
        }

        public void executePreview(MapId mapId, DungeonEditorSessionValues.Preview preview) {
            previewOperationUseCase.execute(mapId, preview);
        }

        public ApplyDungeonEditorAuthoredOperationUseCase applyOperationUseCase() {
            return applyOperationUseCase;
        }

        public ApplyDungeonEditorHandleOperationUseCase handleOperationUseCase() {
            return handleOperationUseCase;
        }

        public CreateDungeonEditorAuthoredStairUseCase createStairUseCase() {
            return createStairUseCase;
        }

        public CreateDungeonEditorAuthoredTransitionUseCase createTransitionUseCase() {
            return createTransitionUseCase;
        }

        public CreateDungeonEditorAuthoredFeatureMarkerUseCase createFeatureMarkerUseCase() {
            return createFeatureMarkerUseCase;
        }

        public DeleteDungeonEditorAuthoredStairUseCase deleteStairUseCase() {
            return deleteStairUseCase;
        }

        public DeleteDungeonEditorAuthoredTransitionUseCase deleteTransitionUseCase() {
            return deleteTransitionUseCase;
        }

        public DeleteDungeonEditorAuthoredFeatureMarkerUseCase deleteFeatureMarkerUseCase() {
            return deleteFeatureMarkerUseCase;
        }

        private CreateDungeonEditorMapCatalogUseCase createMapUseCase() {
            return createMapUseCase;
        }

        private RenameDungeonEditorMapCatalogUseCase renameMapUseCase() {
            return renameMapUseCase;
        }

        private DeleteDungeonEditorMapCatalogUseCase deleteMapUseCase() {
            return deleteMapUseCase;
        }

        private SaveDungeonEditorAuthoredRoomNarrationUseCase saveRoomNarrationUseCase() {
            return saveRoomNarrationUseCase;
        }

        private SaveDungeonEditorAuthoredLabelNameUseCase saveLabelNameUseCase() {
            return saveLabelNameUseCase;
        }

        private SaveDungeonEditorAuthoredTransitionDescriptionUseCase saveTransitionDescriptionUseCase() {
            return saveTransitionDescriptionUseCase;
        }

        private SaveDungeonEditorAuthoredTransitionLinkUseCase saveTransitionLinkUseCase() {
            return saveTransitionLinkUseCase;
        }

        private SaveDungeonEditorAuthoredStairGeometryUseCase saveStairGeometryUseCase() {
            return saveStairGeometryUseCase;
        }
    }

    private record SnapshotParts(
            LoadDungeonMapUseCase loadDungeonMapUseCase,
            PublishDungeonEditorHandlesUseCase publishDungeonEditorHandlesUseCase,
            BuildDungeonDerivedStateUseCase derive,
            AssembleDungeonSnapshotUseCase assembleDungeonSnapshotUseCase
    ) {
    }

    public void applyRoomRectangle(MapId mapId, Cell start, Cell end, boolean deleteMode, Session session) {
        session.applyOperationUseCase().executeRoomRectangle(mapId, start, end, deleteMode);
    }

    public void applyClusterBoundaries(
            MapId mapId,
            long clusterId,
            List<Edge> edges,
            BoundaryKind boundaryKind,
            boolean deleteMode,
            Session session
    ) {
        session.applyOperationUseCase().executeClusterBoundaries(mapId, clusterId, edges, boundaryKind, deleteMode);
    }

    public void applyDoorBoundary(MapId mapId, long clusterId, List<Edge> edges, boolean deleteMode, Session session) {
        session.applyOperationUseCase().executeDoorBoundary(mapId, clusterId, edges, deleteMode);
    }

    public void applyWallBoundary(MapId mapId, long clusterId, List<Edge> edges, boolean deleteMode, Session session) {
        applyClusterBoundaries(mapId, clusterId, edges, BoundaryKind.WALL, deleteMode, session);
    }

    public void moveClusterHandle(MapId mapId, DungeonEditorSessionValues.MoveHandlePreview preview, Session session) {
        session.applyOperationUseCase().executeClusterHandleMove(mapId, preview);
    }

    public void moveDoorHandle(MapId mapId, DungeonEditorSessionValues.MoveHandlePreview preview, Session session) {
        session.handleOperationUseCase().executeDoorHandleMove(mapId, preview);
    }

    public void moveCorridorHandle(MapId mapId, DungeonEditorSessionValues.MoveHandlePreview preview, Session session) {
        session.handleOperationUseCase().executeCorridorHandleMove(mapId, preview);
    }

    public void moveStairHandle(MapId mapId, DungeonEditorSessionValues.MoveHandlePreview preview, Session session) {
        session.applyOperationUseCase().executeStairHandleMove(mapId, preview);
    }

    public void stretchClusterBoundary(
            MapId mapId,
            DungeonEditorSessionValues.MoveBoundaryStretchPreview preview,
            Session session
    ) {
        session.applyOperationUseCase().executeClusterBoundaryStretch(mapId, preview);
    }

    public void applyPreview(MapId mapId, DungeonEditorSessionValues.Preview preview, Session session) {
        session.applyOperationUseCase().execute(mapId, preview);
    }

    public void createCorridor(
            MapId mapId,
            DungeonEditorWorkspaceValues.CorridorEndpoint start,
            DungeonEditorWorkspaceValues.CorridorEndpoint end,
            Session session
    ) {
        session.applyOperationUseCase().executeCreateCorridor(mapId, start, end);
    }

    public void deleteCorridor(MapId mapId, CorridorDeletionTarget target, Session session) {
        session.applyOperationUseCase().executeDeleteCorridor(mapId, target);
    }

    public void createStair(MapId mapId, StairGeometrySpec spec, Session session) {
        session.createStairUseCase().execute(mapId, spec);
    }

    public boolean canCreateStair(MapId mapId, StairGeometrySpec spec, Session session) {
        return session.createStairUseCase().canExecute(mapId, spec);
    }

    public boolean deleteStair(MapId mapId, long stairId, Session session) {
        return session.deleteStairUseCase().execute(mapId, stairId);
    }

    public void createTransition(MapId mapId, TransitionAnchor anchor, TransitionDestination destination, Session session) {
        session.createTransitionUseCase().execute(mapId, anchor, destination);
    }

    public boolean canCreateTransition(
            MapId mapId,
            TransitionAnchor anchor,
            TransitionDestination destination,
            Session session
    ) {
        return session.createTransitionUseCase().canExecute(mapId, anchor, destination);
    }

    public boolean deleteTransition(MapId mapId, long transitionId, Session session) {
        return session.deleteTransitionUseCase().execute(mapId, transitionId);
    }

    public long createFeatureMarker(MapId mapId, FeatureMarkerKind kind, Cell anchor, Session session) {
        return session.createFeatureMarkerUseCase().execute(mapId, kind, anchor);
    }

    public boolean canCreateFeatureMarker(MapId mapId, FeatureMarkerKind kind, Cell anchor, Session session) {
        return session.createFeatureMarkerUseCase().canExecute(mapId, kind, anchor);
    }

    public boolean deleteFeatureMarker(MapId mapId, long markerId, Session session) {
        return session.deleteFeatureMarkerUseCase().execute(mapId, markerId);
    }
}
