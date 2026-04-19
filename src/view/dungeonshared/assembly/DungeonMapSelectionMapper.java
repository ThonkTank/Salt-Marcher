package src.view.dungeonshared.assembly;

import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.mapcore.api.MapSelectionRef;
import src.view.dungeonshared.ViewModel.DungeonSelectionItemViewModel;
import src.view.mapshared.api.MapCellViewModel;
import src.view.mapshared.api.MapWorkspaceSession;

final class DungeonMapSelectionMapper {

    private DungeonMapSelectionMapper() {
    }

    static void applySelection(
            MapWorkspaceSession workspaceSession,
            Consumer<MapSelectionRef> inspectorSelectionConsumer,
            @Nullable MapSelectionRef selectionRef
    ) {
        Objects.requireNonNull(workspaceSession, "workspaceSession");
        Objects.requireNonNull(inspectorSelectionConsumer, "inspectorSelectionConsumer");
        if (selectionRef == null) {
            workspaceSession.setSelectedTarget(null, -1L, null);
        } else {
            workspaceSession.setSelectedTarget(selectionRef.ownerKind(), selectionRef.ownerId(), selectionRef.partKind());
        }
        inspectorSelectionConsumer.accept(selectionRef);
    }

    static void refreshSelection(
            @Nullable BaseMapSnapshot snapshot,
            @Nullable MapSelectionRef currentSelection,
            Consumer<MapSelectionRef> selectionConsumer
    ) {
        Objects.requireNonNull(selectionConsumer, "selectionConsumer");
        if (snapshot == null) {
            if (currentSelection != null) {
                selectionConsumer.accept(null);
            }
            return;
        }
        if (currentSelection == null) {
            return;
        }
        MapSelectionRef resolved = resolveSelection(snapshot, currentSelection);
        if (!Objects.equals(resolved, currentSelection)) {
            selectionConsumer.accept(resolved);
        }
    }

    static @Nullable MapSelectionRef resolveSelection(
            @Nullable BaseMapSnapshot snapshot,
            @Nullable MapCellViewModel cellViewModel
    ) {
        if (snapshot == null || cellViewModel == null) {
            return null;
        }
        return snapshot.selectableTargets().stream()
                .filter(target -> target.ownerId() == cellViewModel.ownerId())
                .filter(target -> target.ownerKind().equalsIgnoreCase(cellViewModel.ownerKind()))
                .filter(target -> target.partKind().equalsIgnoreCase(cellViewModel.partKind()))
                .findFirst()
                .orElse(null);
    }

    static @Nullable MapSelectionRef resolveSelection(
            @Nullable BaseMapSnapshot snapshot,
            @Nullable MapSelectionRef selection
    ) {
        if (snapshot == null || selection == null) {
            return null;
        }
        return snapshot.selectableTargets().stream()
                .filter(candidate -> candidate.ownerId() == selection.ownerId())
                .filter(candidate -> candidate.ownerKind().equalsIgnoreCase(selection.ownerKind()))
                .filter(candidate -> candidate.partKind().equalsIgnoreCase(selection.partKind()))
                .findFirst()
                .orElse(null);
    }

    static @Nullable MapSelectionRef toDomain(
            @Nullable BaseMapSnapshot snapshot,
            @Nullable DungeonSelectionItemViewModel selection
    ) {
        if (selection == null) {
            return null;
        }
        return snapshot == null
                ? null
                : snapshot.selectableTargets().stream()
                        .filter(candidate -> candidate.ownerId() == selection.ownerId())
                        .filter(candidate -> candidate.ownerKind().equalsIgnoreCase(selection.ownerKind()))
                        .filter(candidate -> candidate.partKind().equalsIgnoreCase(selection.partKind()))
                        .findFirst()
                        .orElse(null);
    }

    static @Nullable DungeonSelectionItemViewModel toView(@Nullable MapSelectionRef selection) {
        return selection == null
                ? null
                : new DungeonSelectionItemViewModel(
                        selection.ownerKind(),
                        selection.ownerId(),
                        selection.partKind(),
                        selection.label());
    }
}
