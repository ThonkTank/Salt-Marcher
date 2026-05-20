package src.domain.dungeon.model.editor.port;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAuthoredMutationModel;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadModel;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapCatalogModel;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonFacts;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.helper.DungeonEditorWorkspaceInspectorBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.helper.DungeonEditorWorkspaceMapBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary;

public final class DungeonEditorDungeonPort {

    private final PublishedIntakeState state = new PublishedIntakeState();

    public DungeonEditorDungeonPort(
            DungeonMapCatalogModel catalogModel,
            DungeonAuthoredReadModel authoredReadModel,
            DungeonAuthoredMutationModel authoredMutationModel
    ) {
        DungeonMapCatalogModel catalog = Objects.requireNonNull(catalogModel, "catalogModel");
        DungeonAuthoredReadModel authoredRead = Objects.requireNonNull(authoredReadModel, "authoredReadModel");
        DungeonAuthoredMutationModel authoredMutation = Objects.requireNonNull(authoredMutationModel, "authoredMutationModel");
        state.replaceCatalog(catalog.current());
        applyReadResult(authoredRead.current());
        state.replaceMutation(authoredMutation.current());
        catalog.subscribe(state::replaceCatalog);
        authoredRead.subscribe(this::applyReadResult);
        authoredMutation.subscribe(state::replaceMutation);
    }

    public DungeonEditorDungeonFacts currentFacts(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        return facts(mapId, selection, preview);
    }

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
                committedMap(state.committedSnapshot()),
                currentSurface(mapId, selection, preview),
                mutationStatusText(),
                previewStatusText(preview));
    }

    private DungeonEditorSessionSnapshot.@Nullable SurfaceData currentSurface(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        if (mapId == null || state.committedSnapshot() == null) {
            return null;
        }
        MapSnapshot committedMap =
                DungeonEditorWorkspaceMapBoundaryTranslationHelper.toWorkspaceMapSnapshot(state.committedSnapshot().map());
        MapSnapshot previewMap = previewMap(preview, committedMap);
        return new DungeonEditorSessionSnapshot.SurfaceData(
                state.committedSnapshot().mapName(),
                state.committedSnapshot().revision(),
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
        if (safeSelection.topologyRef().equals(DungeonTopologyElementRef.empty())
                && !safeSelection.clusterSelection()) {
            return null;
        }
        return DungeonEditorWorkspaceInspectorBoundaryTranslationHelper.toWorkspaceInspector(state.inspector());
    }

    private List<MapSummary> mapSummaries() {
        if (state.catalog() instanceof DungeonMapCatalogResponse.MapList mapList) {
            return mapList.maps().stream()
                    .map(DungeonEditorWorkspaceMapBoundaryTranslationHelper::toWorkspaceMapSummary)
                    .toList();
        }
        return List.of();
    }

    private @Nullable MapId mutationMapId() {
        if (state.catalog() instanceof DungeonMapCatalogResponse.MapMutation mutation) {
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
        if (state.mutation() instanceof DungeonAuthoredMutationResult.Operation operation) {
            return operation.result();
        }
        return null;
    }

    private void applyReadResult(@Nullable DungeonAuthoredReadResult result) {
        if (result instanceof DungeonAuthoredReadResult.CommittedSnapshot committedSnapshot) {
            state.replaceCommittedSnapshot(committedSnapshot.snapshot());
        } else if (result instanceof DungeonAuthoredReadResult.SelectionInspector selectionInspector) {
            state.replaceInspector(selectionInspector.inspector());
        }
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

    private static final class PublishedIntakeState {
        private DungeonMapCatalogResponse catalog;
        private @Nullable DungeonSnapshot committedSnapshot;
        private @Nullable DungeonInspectorSnapshot inspector;
        private DungeonAuthoredMutationResult mutation;

        private PublishedIntakeState() {
            catalog = new DungeonMapCatalogResponse.MapList(List.of());
            mutation = new DungeonAuthoredMutationResult.Operation(null);
        }

        private DungeonMapCatalogResponse catalog() {
            return catalog;
        }

        private @Nullable DungeonSnapshot committedSnapshot() {
            return committedSnapshot;
        }

        private @Nullable DungeonInspectorSnapshot inspector() {
            return inspector;
        }

        private DungeonAuthoredMutationResult mutation() {
            return mutation;
        }

        private void replaceCatalog(DungeonMapCatalogResponse catalog) {
            this.catalog = catalog;
        }

        private void replaceCommittedSnapshot(@Nullable DungeonSnapshot committedSnapshot) {
            this.committedSnapshot = committedSnapshot;
        }

        private void replaceInspector(@Nullable DungeonInspectorSnapshot inspector) {
            this.inspector = inspector;
        }

        private void replaceMutation(DungeonAuthoredMutationResult mutation) {
            this.mutation = mutation;
        }
    }
}
