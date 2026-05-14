package src.domain.dungeon.model.editor.model.session.port;

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
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonFacts;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.helper.DungeonEditorWorkspaceInspectorBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.model.workspace.helper.DungeonEditorWorkspaceMapBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary;

public final class DungeonEditorDungeonPort {

    private DungeonMapCatalogResponse currentCatalog;
    private @Nullable DungeonSnapshot currentCommittedSnapshot;
    private @Nullable DungeonInspectorSnapshot currentInspector;
    private DungeonAuthoredMutationResult currentMutation;

    public DungeonEditorDungeonPort(
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
