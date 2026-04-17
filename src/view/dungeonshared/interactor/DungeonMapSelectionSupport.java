package src.view.dungeonshared.interactor;

import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.mapcore.api.MapSelectionRef;
import src.view.mapshared.Model.MapCellViewModel;
import src.view.mapshared.View.MapWorkspaceView;

import java.util.List;
import java.util.Objects;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Shared selection utilities for dungeon editor and travel workspaces.
 */
public final class DungeonMapSelectionSupport {

    private DungeonMapSelectionSupport() {
    }

    public static void applySelection(
            MapWorkspaceView workspaceView,
            Consumer<MapSelectionRef> stateSelectionConsumer,
            Consumer<MapSelectionRef> inspectorSelectionConsumer,
            @Nullable MapSelectionRef selectionRef
    ) {
        Objects.requireNonNull(workspaceView, "workspaceView");
        Objects.requireNonNull(stateSelectionConsumer, "stateSelectionConsumer");
        Objects.requireNonNull(inspectorSelectionConsumer, "inspectorSelectionConsumer");
        if (selectionRef == null) {
            workspaceView.setSelectedTarget(null, -1L, null);
        } else {
            workspaceView.setSelectedTarget(selectionRef.ownerKind(), selectionRef.ownerId(), selectionRef.partKind());
        }
        stateSelectionConsumer.accept(selectionRef);
        inspectorSelectionConsumer.accept(selectionRef);
    }

    public static void refreshSelection(
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

    public static @Nullable MapSelectionRef resolveSelection(
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

    public static @Nullable MapSelectionRef resolveSelection(
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

    public static void configureSelectionList(
            ListView<MapSelectionRef> objectList,
            double prefHeight,
            BooleanSupplier syncingSelectionSupplier,
            Supplier<Consumer<MapSelectionRef>> selectionHandlerSupplier
    ) {
        Objects.requireNonNull(objectList, "objectList");
        Objects.requireNonNull(syncingSelectionSupplier, "syncingSelectionSupplier");
        Objects.requireNonNull(selectionHandlerSupplier, "selectionHandlerSupplier");
        objectList.setPrefHeight(prefHeight);
        objectList.setCellFactory(ignored -> new ListCell<>() {
            @Override
            protected void updateItem(MapSelectionRef item, boolean empty) {
                super.updateItem(item, empty);
                setText(empty || item == null ? null : item.ownerKind() + " · " + item.label());
            }
        });
        objectList.getSelectionModel().selectedItemProperty().addListener((ignored, before, after) -> {
            if (!syncingSelectionSupplier.getAsBoolean() && after != null) {
                selectionHandlerSupplier.get().accept(after);
            }
        });
    }

    public static @Nullable MapSelectionRef syncSelectionList(
            ListView<MapSelectionRef> objectList,
            @Nullable BaseMapSnapshot snapshot,
            @Nullable MapSelectionRef selectedTarget
    ) {
        Objects.requireNonNull(objectList, "objectList");
        objectList.getItems().setAll(snapshot == null ? List.of() : snapshot.selectableTargets());
        MapSelectionRef resolved = resolveSelection(snapshot, selectedTarget);
        if (resolved == null) {
            objectList.getSelectionModel().clearSelection();
        } else {
            objectList.getSelectionModel().select(resolved);
        }
        return resolved;
    }
}
