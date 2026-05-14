package src.data.dungeoneditor;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import shell.api.ServiceRegistry;
import src.domain.dungeon.DungeonAuthoredApplicationService;
import src.domain.dungeon.DungeonCatalogApplicationService;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationModel;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadCommand;
import src.domain.dungeon.published.DungeonAuthoredReadModel;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapCatalogModel;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeoneditor.DungeonEditorApplicationService;
import src.domain.dungeoneditor.application.ApplyDungeonEditorSessionUseCase;
import src.domain.dungeoneditor.model.session.helper.DungeonEditorSessionOperationBoundaryTranslationHelper;
import src.domain.dungeoneditor.model.session.model.DungeonEditorDungeonFacts;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionCommand;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeoneditor.model.session.port.DungeonEditorDungeonPort;
import src.domain.dungeoneditor.model.session.repository.DungeonEditorDungeonRepository;
import src.domain.dungeoneditor.model.workspace.helper.DungeonEditorWorkspaceInspectorBoundaryTranslationHelper;
import src.domain.dungeoneditor.model.workspace.helper.DungeonEditorWorkspaceMapBoundaryTranslationHelper;
import src.domain.dungeoneditor.model.workspace.helper.DungeonEditorWorkspaceTopologyBoundaryTranslationHelper;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.TopologyElementRef;

@SuppressWarnings({"PMD.ExcessiveImports", "PMD.CouplingBetweenObjects"})
final class DungeonEditorServiceAssembly {

    DungeonEditorApplicationService create(ServiceRegistry registry) {
        ServiceRegistry services = Objects.requireNonNull(registry, "registry");
        DungeonEditorDungeonRepository dungeonRepository = new ApplicationDungeonEditorDungeonRepository(
                services.require(DungeonCatalogApplicationService.class),
                services.require(DungeonAuthoredApplicationService.class));
        DungeonEditorDungeonPort dungeonPort = new ApplicationDungeonEditorDungeonPort(
                services.require(DungeonMapCatalogModel.class),
                services.require(DungeonAuthoredReadModel.class),
                services.require(DungeonAuthoredMutationModel.class));
        return new DungeonEditorApplicationService(new ApplyDungeonEditorSessionUseCase(dungeonRepository, dungeonPort));
    }

    private static final class ApplicationDungeonEditorDungeonRepository implements DungeonEditorDungeonRepository {

        private final DungeonCatalogApplicationService catalogService;
        private final DungeonAuthoredApplicationService authoredService;

        private ApplicationDungeonEditorDungeonRepository(
                DungeonCatalogApplicationService catalogService,
                DungeonAuthoredApplicationService authoredService
        ) {
            this.catalogService = Objects.requireNonNull(catalogService, "catalogService");
            this.authoredService = Objects.requireNonNull(authoredService, "authoredService");
        }

        @Override
        public void searchMaps(String query) {
            catalogService.catalog(new DungeonMapCatalogCommand.Search(query));
        }

        @Override
        public void createMap(String mapName) {
            catalogService.catalog(new DungeonMapCatalogCommand.CreateMap(mapName));
        }

        @Override
        public void renameMap(@Nullable MapId mapId, String mapName) {
            catalogService.catalog(new DungeonMapCatalogCommand.RenameMap(domainMapId(mapId), mapName));
        }

        @Override
        public void deleteMap(@Nullable MapId mapId) {
            catalogService.catalog(new DungeonAuthoredReadCommand.MapSelection(domainMapId(mapId)));
        }

        @Override
        public void loadMap(@Nullable MapId mapId) {
            if (mapId != null) {
                authoredService.refreshAuthored(new DungeonAuthoredReadCommand.MapSelection(domainMapId(mapId)));
            }
        }

        @Override
        public void describeSelection(
                @Nullable MapId mapId,
                TopologyElementRef topologyRef,
                long clusterId,
                boolean clusterSelection
        ) {
            if (mapId == null || (TopologyElementRef.empty().equals(topologyRef) && !clusterSelection)) {
                return;
            }
            authoredService.refreshAuthored(new DungeonAuthoredReadCommand.DescribeSelection(
                    domainMapId(mapId),
                    DungeonEditorWorkspaceTopologyBoundaryTranslationHelper.toDomainTopologyRef(topologyRef),
                    clusterId,
                    clusterSelection));
        }

        @Override
        public void previewOperation(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview) {
            applyMutation(DungeonAuthoredMutationCommand.Action.PREVIEW, mapId, preview);
        }

        @Override
        public void applyOperation(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview) {
            applyMutation(DungeonAuthoredMutationCommand.Action.APPLY, mapId, preview);
        }

        @Override
        public void saveRoomNarration(@Nullable MapId mapId, DungeonEditorSessionCommand.RoomNarrationInput roomNarration) {
            if (mapId == null || roomNarration == null || !DungeonEditorWorkspaceValues.hasId(roomNarration.roomId())) {
                return;
            }
            authoredService.mutateAuthored(new DungeonAuthoredMutationCommand.Operation(
                    DungeonAuthoredMutationCommand.Action.APPLY,
                    domainMapId(mapId),
                    new DungeonEditorOperation.SaveRoomNarration(
                            roomNarration.roomId(),
                            roomNarration.visualDescription(),
                            roomNarration.exits().stream()
                                    .map(DungeonEditorWorkspaceInspectorBoundaryTranslationHelper::toDomainRoomExit)
                                    .toList())));
        }

        private void applyMutation(
                DungeonAuthoredMutationCommand.Action action,
                @Nullable MapId mapId,
                DungeonEditorSessionValues.Preview preview
        ) {
            DungeonEditorOperation operation = DungeonEditorSessionOperationBoundaryTranslationHelper.toDungeonOperation(preview);
            if (mapId != null && operation != null) {
                authoredService.mutateAuthored(new DungeonAuthoredMutationCommand.Operation(action, domainMapId(mapId), operation));
            }
        }
    }

    private static final class ApplicationDungeonEditorDungeonPort implements DungeonEditorDungeonPort {

        private DungeonMapCatalogResponse currentCatalog;
        private @Nullable DungeonSnapshot currentCommittedSnapshot;
        private @Nullable DungeonInspectorSnapshot currentInspector;
        private DungeonAuthoredMutationResult currentMutation;

        private ApplicationDungeonEditorDungeonPort(
                DungeonMapCatalogModel catalogModel,
                DungeonAuthoredReadModel authoredReadModel,
                DungeonAuthoredMutationModel authoredMutationModel
        ) {
            DungeonMapCatalogModel catalog = Objects.requireNonNull(catalogModel, "catalogModel");
            DungeonAuthoredReadModel authoredRead = Objects.requireNonNull(authoredReadModel, "authoredReadModel");
            DungeonAuthoredMutationModel authoredMutation = Objects.requireNonNull(authoredMutationModel, "authoredMutationModel");
            currentCatalog = catalog.current();
            applyReadResult(authoredRead.current());
            currentMutation = authoredMutation.current();
            catalog.subscribe(response -> currentCatalog = response);
            authoredRead.subscribe(this::applyReadResult);
            authoredMutation.subscribe(result -> currentMutation = result);
        }

        @Override
        public DungeonEditorDungeonFacts currentFacts(
                @Nullable MapId mapId,
                DungeonEditorSessionValues.Selection selection,
                DungeonEditorSessionValues.Preview preview
        ) {
            return facts(mapId, selection, preview);
        }

        @Override
        public DungeonEditorDungeonFacts committedFacts(@Nullable MapId mapId) {
            return facts(mapId, DungeonEditorSessionValues.Selection.empty(), DungeonEditorSessionValues.Preview.none());
        }

        private DungeonEditorDungeonFacts facts(
                @Nullable MapId mapId,
                DungeonEditorSessionValues.Selection selection,
                DungeonEditorSessionValues.Preview preview
        ) {
            return new DungeonEditorDungeonFacts(
                    mapSummaries(),
                    mutationMapId(),
                    committedMap(currentCommittedSnapshot),
                    currentSurface(mapId, selection, preview),
                    mutationStatusText(),
                    previewStatusText(preview));
        }

        private DungeonEditorSessionSnapshot.@Nullable SurfaceData currentSurface(
                @Nullable MapId mapId,
                DungeonEditorSessionValues.Selection selection,
                DungeonEditorSessionValues.Preview preview
        ) {
            if (mapId == null || currentCommittedSnapshot == null) {
                return null;
            }
            MapSnapshot committedMap =
                    DungeonEditorWorkspaceMapBoundaryTranslationHelper.toWorkspaceMapSnapshot(currentCommittedSnapshot.map());
            MapSnapshot previewMap = previewMap(preview, committedMap);
            return new DungeonEditorSessionSnapshot.SurfaceData(
                    currentCommittedSnapshot.mapName(),
                    currentCommittedSnapshot.revision(),
                    committedMap,
                    previewMap,
                    inspector(selection));
        }

        private @Nullable MapSnapshot previewMap(
                DungeonEditorSessionValues.Preview preview,
                MapSnapshot committedMap
        ) {
            DungeonOperationResult previewResult = operationResult();
            MapSnapshot candidate = preview == DungeonEditorSessionValues.Preview.none() || previewResult == null
                    ? null
                    : DungeonEditorWorkspaceMapBoundaryTranslationHelper.toWorkspacePreviewMap(previewResult.snapshot());
            return candidate != null && candidate.equals(committedMap) ? null : candidate;
        }

        private DungeonEditorWorkspaceValues.@Nullable Inspector inspector(
                DungeonEditorSessionValues.Selection selection
        ) {
            DungeonEditorSessionValues.Selection safeSelection = selection == null
                    ? DungeonEditorSessionValues.Selection.empty()
                    : selection;
            if (safeSelection.topologyRef().equals(DungeonEditorWorkspaceValues.TopologyElementRef.empty())
                    && !safeSelection.clusterSelection()) {
                return null;
            }
            return DungeonEditorWorkspaceInspectorBoundaryTranslationHelper.toWorkspaceInspector(currentInspector);
        }

        private List<MapSummary> mapSummaries() {
            if (currentCatalog instanceof DungeonMapCatalogResponse.MapList mapList) {
                return mapList.maps().stream()
                        .map(DungeonEditorWorkspaceMapBoundaryTranslationHelper::toWorkspaceMapSummary)
                        .toList();
            }
            return List.of();
        }

        private @Nullable MapId mutationMapId() {
            if (currentCatalog instanceof DungeonMapCatalogResponse.MapMutation mutation) {
                return DungeonEditorWorkspaceMapBoundaryTranslationHelper.toWorkspaceMapId(mutation.mapId());
            }
            return null;
        }

        private String mutationStatusText() {
            return statusFromMessages(operationResult());
        }

        private String previewStatusText(DungeonEditorSessionValues.Preview preview) {
            return preview == DungeonEditorSessionValues.Preview.none() ? "" : statusFromMessages(operationResult());
        }

        private @Nullable DungeonOperationResult operationResult() {
            if (currentMutation instanceof DungeonAuthoredMutationResult.Operation operation) {
                return operation.result();
            }
            return null;
        }

        private void applyReadResult(@Nullable DungeonAuthoredReadResult result) {
            if (result instanceof DungeonAuthoredReadResult.CommittedSnapshot committedSnapshot) {
                currentCommittedSnapshot = committedSnapshot.snapshot();
            } else if (result instanceof DungeonAuthoredReadResult.SelectionInspector selectionInspector) {
                currentInspector = selectionInspector.inspector();
            }
        }
    }

    private static DungeonMapId domainMapId(@Nullable MapId mapId) {
        DungeonMapId domainId = DungeonEditorWorkspaceMapBoundaryTranslationHelper.toDomainMapId(mapId);
        return domainId == null ? new DungeonMapId(1L) : domainId;
    }

    private static @Nullable MapSnapshot committedMap(@Nullable DungeonSnapshot snapshot) {
        return snapshot == null ? null : DungeonEditorWorkspaceMapBoundaryTranslationHelper.toWorkspaceMapSnapshot(snapshot.map());
    }

    private static String statusFromMessages(@Nullable DungeonOperationResult result) {
        if (result == null) {
            return "";
        }
        if (!result.reactionMessages().isEmpty()) {
            return result.reactionMessages().getFirst();
        }
        if (!result.validationMessages().isEmpty()) {
            return result.validationMessages().getFirst();
        }
        return "";
    }
}
