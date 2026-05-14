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
            catalogService.catalog(new DungeonMapCatalogCommand.RenameMap(DungeonEditorDungeonCommands.domainMapId(mapId), mapName));
        }

        @Override
        public void deleteMap(@Nullable MapId mapId) {
            catalogService.catalog(new DungeonAuthoredReadCommand.MapSelection(DungeonEditorDungeonCommands.domainMapId(mapId)));
        }

        @Override
        public void loadMap(@Nullable MapId mapId) {
            DungeonEditorDungeonCommands.loadMap(authoredService, mapId);
        }

        @Override
        public void describeSelection(
                @Nullable MapId mapId,
                TopologyElementRef topologyRef,
                long clusterId,
                boolean clusterSelection
        ) {
            DungeonEditorDungeonCommands.describeSelection(authoredService, mapId, topologyRef, clusterId, clusterSelection);
        }

        @Override
        public void previewOperation(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview) {
            DungeonEditorDungeonCommands.applyMutation(authoredService, DungeonAuthoredMutationCommand.Action.PREVIEW, mapId, preview);
        }

        @Override
        public void applyOperation(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview) {
            DungeonEditorDungeonCommands.applyMutation(authoredService, DungeonAuthoredMutationCommand.Action.APPLY, mapId, preview);
        }

        @Override
        public void saveRoomNarration(@Nullable MapId mapId, DungeonEditorSessionCommand.RoomNarrationInput roomNarration) {
            DungeonEditorDungeonCommands.saveRoomNarration(authoredService, mapId, roomNarration);
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
            return DungeonEditorDungeonFactsMapper.facts(
                    currentCatalog,
                    currentCommittedSnapshot,
                    currentInspector,
                    currentMutation,
                    mapId,
                    selection,
                    preview);
        }

        @Override
        public DungeonEditorDungeonFacts committedFacts(@Nullable MapId mapId) {
            return DungeonEditorDungeonFactsMapper.facts(
                    currentCatalog,
                    currentCommittedSnapshot,
                    currentInspector,
                    currentMutation,
                    mapId,
                    DungeonEditorSessionValues.Selection.empty(),
                    DungeonEditorSessionValues.Preview.none());
        }

        private void applyReadResult(@Nullable DungeonAuthoredReadResult result) {
            if (result instanceof DungeonAuthoredReadResult.CommittedSnapshot committedSnapshot) {
                currentCommittedSnapshot = committedSnapshot.snapshot();
            } else if (result instanceof DungeonAuthoredReadResult.SelectionInspector selectionInspector) {
                currentInspector = selectionInspector.inspector();
            }
        }
    }

    private static final class DungeonEditorDungeonCommands {

        private DungeonEditorDungeonCommands() {
        }

        private static void loadMap(DungeonAuthoredApplicationService authoredService, @Nullable MapId mapId) {
            if (mapId != null) {
                authoredService.refreshAuthored(new DungeonAuthoredReadCommand.MapSelection(domainMapId(mapId)));
            }
        }

        private static void describeSelection(
                DungeonAuthoredApplicationService authoredService,
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

        private static void applyMutation(
                DungeonAuthoredApplicationService authoredService,
                DungeonAuthoredMutationCommand.Action action,
                @Nullable MapId mapId,
                DungeonEditorSessionValues.Preview preview
        ) {
            DungeonEditorOperation operation = DungeonEditorSessionOperationBoundaryTranslationHelper.toDungeonOperation(preview);
            if (mapId != null && operation != null) {
                authoredService.mutateAuthored(new DungeonAuthoredMutationCommand.Operation(action, domainMapId(mapId), operation));
            }
        }

        private static void saveRoomNarration(
                DungeonAuthoredApplicationService authoredService,
                @Nullable MapId mapId,
                DungeonEditorSessionCommand.RoomNarrationInput roomNarration
        ) {
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

        private static DungeonMapId domainMapId(@Nullable MapId mapId) {
            DungeonMapId domainId = DungeonEditorWorkspaceMapBoundaryTranslationHelper.toDomainMapId(mapId);
            return domainId == null ? new DungeonMapId(1L) : domainId;
        }
    }

    private static final class DungeonEditorDungeonFactsMapper {

        private DungeonEditorDungeonFactsMapper() {
        }

        private static DungeonEditorDungeonFacts facts(
                @Nullable DungeonMapCatalogResponse catalog,
                @Nullable DungeonSnapshot committedSnapshot,
                @Nullable DungeonInspectorSnapshot inspector,
                @Nullable DungeonAuthoredMutationResult mutation,
                @Nullable MapId mapId,
                DungeonEditorSessionValues.Selection selection,
                DungeonEditorSessionValues.Preview preview
        ) {
            return new DungeonEditorDungeonFacts(
                    DungeonEditorDungeonCatalogFacts.mapSummaries(catalog),
                    DungeonEditorDungeonCatalogFacts.mutationMapId(catalog),
                    committedMap(committedSnapshot),
                    currentSurface(committedSnapshot, inspector, mutation, mapId, selection, preview),
                    DungeonEditorDungeonStatusFacts.mutationStatusText(mutation),
                    DungeonEditorDungeonStatusFacts.previewStatusText(mutation, preview));
        }

        private static DungeonEditorSessionSnapshot.@Nullable SurfaceData currentSurface(
                @Nullable DungeonSnapshot committedSnapshot,
                @Nullable DungeonInspectorSnapshot inspector,
                @Nullable DungeonAuthoredMutationResult mutation,
                @Nullable MapId mapId,
                DungeonEditorSessionValues.Selection selection,
                DungeonEditorSessionValues.Preview preview
        ) {
            if (mapId == null || committedSnapshot == null) {
                return null;
            }
            MapSnapshot committedMap = DungeonEditorWorkspaceMapBoundaryTranslationHelper.toWorkspaceMapSnapshot(committedSnapshot.map());
            MapSnapshot previewMap = previewMap(mutation, preview, committedMap);
            return new DungeonEditorSessionSnapshot.SurfaceData(
                    committedSnapshot.mapName(),
                    committedSnapshot.revision(),
                    committedMap,
                    previewMap,
                    inspector(selection, inspector));
        }

        private static @Nullable MapSnapshot previewMap(
                @Nullable DungeonAuthoredMutationResult mutation,
                DungeonEditorSessionValues.Preview preview,
                MapSnapshot committedMap
        ) {
            DungeonOperationResult previewResult = DungeonEditorDungeonStatusFacts.operationResult(mutation);
            MapSnapshot candidate = preview == DungeonEditorSessionValues.Preview.none() || previewResult == null
                    ? null
                    : DungeonEditorWorkspaceMapBoundaryTranslationHelper.toWorkspacePreviewMap(previewResult.snapshot());
            return candidate != null && candidate.equals(committedMap) ? null : candidate;
        }

        private static DungeonEditorWorkspaceValues.@Nullable Inspector inspector(
                DungeonEditorSessionValues.Selection selection,
                @Nullable DungeonInspectorSnapshot inspector
        ) {
            DungeonEditorSessionValues.Selection safeSelection = selection == null
                    ? DungeonEditorSessionValues.Selection.empty()
                    : selection;
            if (safeSelection.topologyRef().equals(DungeonEditorWorkspaceValues.TopologyElementRef.empty())
                    && !safeSelection.clusterSelection()) {
                return null;
            }
            return DungeonEditorWorkspaceInspectorBoundaryTranslationHelper.toWorkspaceInspector(inspector);
        }

        private static @Nullable MapSnapshot committedMap(@Nullable DungeonSnapshot snapshot) {
            return snapshot == null ? null : DungeonEditorWorkspaceMapBoundaryTranslationHelper.toWorkspaceMapSnapshot(snapshot.map());
        }

    }

    private static final class DungeonEditorDungeonCatalogFacts {

        private DungeonEditorDungeonCatalogFacts() {
        }

        private static List<MapSummary> mapSummaries(@Nullable DungeonMapCatalogResponse response) {
            if (response instanceof DungeonMapCatalogResponse.MapList mapList) {
                return mapList.maps().stream()
                        .map(DungeonEditorWorkspaceMapBoundaryTranslationHelper::toWorkspaceMapSummary)
                        .toList();
            }
            return List.of();
        }

        private static @Nullable MapId mutationMapId(@Nullable DungeonMapCatalogResponse response) {
            if (response instanceof DungeonMapCatalogResponse.MapMutation mutation) {
                return DungeonEditorWorkspaceMapBoundaryTranslationHelper.toWorkspaceMapId(mutation.mapId());
            }
            return null;
        }
    }

    private static final class DungeonEditorDungeonStatusFacts {

        private DungeonEditorDungeonStatusFacts() {
        }

        private static String mutationStatusText(@Nullable DungeonAuthoredMutationResult mutation) {
            return statusFromMessages(operationResult(mutation));
        }

        private static String previewStatusText(
                @Nullable DungeonAuthoredMutationResult mutation,
                DungeonEditorSessionValues.Preview preview
        ) {
            return preview == DungeonEditorSessionValues.Preview.none() ? "" : statusFromMessages(operationResult(mutation));
        }

        private static @Nullable DungeonOperationResult operationResult(@Nullable DungeonAuthoredMutationResult mutation) {
            if (mutation instanceof DungeonAuthoredMutationResult.Operation operation) {
                return operation.result();
            }
            return null;
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
}
