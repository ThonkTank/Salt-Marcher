package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.transition.Transition;
import features.dungeon.domain.core.structure.transition.TransitionCatalog;
import features.dungeon.domain.core.structure.transition.TransitionCatalog.AuthoredTransitionLinkMap;
import features.dungeon.domain.core.structure.transition.TransitionCatalog.AuthoredTransitionLinkRewrite;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.OptionalLong;
import java.util.Set;

/** Plans one exact atomic transition-link command across its loaded map closure. */
public final class TransitionLinkCommand {

    public DungeonCompoundCommandResult plan(
            Collection<DungeonMap> loadedMaps,
            long sourceMapId,
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional,
            Set<Long> knownMissingMapIds
    ) {
        Map<Long, DungeonMap> mapsById = mapsById(loadedMaps);
        AuthoredTransitionLinkRewrite rewrite = TransitionCatalog.authoredTransitionLinkRewrite(
                catalogMaps(mapsById.values()),
                sourceMapId,
                sourceTransitionId,
                targetMapId,
                targetTransitionId,
                bidirectional);
        OptionalLong requestedMapId = rewrite.requestedMapId();
        if (requestedMapId.isPresent()) {
            long requiredMapId = requestedMapId.orElseThrow();
            if (knownMissingMapIds == null || !knownMissingMapIds.contains(requiredMapId)) {
                return new DungeonCompoundCommandResult.RequiresMap(requiredMapId);
            }
            rewrite = rewrite.acceptMissingRequestedMap();
        }
        if (!rewrite.accepted()) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.MISSING_TRANSITION_DESTINATION);
        }
        List<DungeonPatch> patches = new ArrayList<>();
        for (DungeonMap map : mapsById.values()) {
            TransitionCatalog nextCatalog = rewrite.catalogFor(
                    map.metadata().mapId().value(),
                    map.transitionCatalog());
            List<DungeonPatchChange> changes = transitionChanges(map.transitionCatalog(), nextCatalog);
            if (!changes.isEmpty()) {
                patches.add(DungeonPatch.of(map.metadata().mapId(), map.revision(), changes));
            }
        }
        if (patches.isEmpty()) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT);
        }
        return DungeonCompoundCommandResult.Accepted.from(DungeonCompoundPatch.of(patches));
    }

    private static List<DungeonPatchChange> transitionChanges(
            TransitionCatalog before,
            TransitionCatalog after
    ) {
        Map<Long, Transition> afterById = transitionsById(after.transitions());
        List<DungeonPatchChange> result = new ArrayList<>();
        for (Transition transition : before.transitions()) {
            Transition next = afterById.remove(transition.transitionId());
            if (!transition.equals(next)) {
                result.add(new TransitionChange(transition, next));
            }
        }
        for (Transition transition : after.transitions()) {
            if (afterById.containsKey(transition.transitionId())) {
                result.add(new TransitionChange(null, transition));
            }
        }
        return List.copyOf(result);
    }

    private static Map<Long, Transition> transitionsById(List<Transition> transitions) {
        Map<Long, Transition> result = new LinkedHashMap<>();
        for (Transition transition : transitions) {
            result.put(transition.transitionId(), transition);
        }
        return result;
    }

    private static Map<Long, DungeonMap> mapsById(Collection<DungeonMap> maps) {
        Map<Long, DungeonMap> result = new LinkedHashMap<>();
        for (DungeonMap map : maps == null ? List.<DungeonMap>of() : maps) {
            if (map != null) {
                result.put(map.metadata().mapId().value(), map);
            }
        }
        return result;
    }

    private static List<AuthoredTransitionLinkMap> catalogMaps(Collection<DungeonMap> maps) {
        List<AuthoredTransitionLinkMap> result = new ArrayList<>();
        for (DungeonMap map : maps) {
            result.add(new AuthoredTransitionLinkMap(
                    map.metadata().mapId().value(),
                    map.transitionCatalog()));
        }
        return List.copyOf(result);
    }

    private static DungeonCompoundCommandResult.Rejected rejected(
            DungeonEditorCommandOutcome.RejectionReason reason
    ) {
        return new DungeonCompoundCommandResult.Rejected(reason);
    }
}
