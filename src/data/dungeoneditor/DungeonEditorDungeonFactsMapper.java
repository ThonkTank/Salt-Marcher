package src.data.dungeoneditor;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeoneditor.model.session.model.DungeonEditorDungeonFacts;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeoneditor.model.workspace.helper.DungeonEditorWorkspaceInspectorBoundaryTranslationHelper;
import src.domain.dungeoneditor.model.workspace.helper.DungeonEditorWorkspaceMapBoundaryTranslationHelper;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;

final class DungeonEditorDungeonFactsMapper {

    private DungeonEditorDungeonFactsMapper() {
        throw new AssertionError("No instances.");
    }

    static DungeonEditorDungeonFacts facts(
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
