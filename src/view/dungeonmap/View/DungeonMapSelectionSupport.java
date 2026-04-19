package src.view.dungeonshared.View;

import java.util.List;
import java.util.Objects;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.Supplier;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import org.jspecify.annotations.Nullable;
import src.view.dungeonshared.ViewModel.DungeonLoadedMapViewModel;
import src.view.dungeonshared.ViewModel.DungeonSelectionItemViewModel;

public final class DungeonMapSelectionSupport {

    private DungeonMapSelectionSupport() {
    }

    public static void configureSelectionList(
            ListView<DungeonSelectionItemViewModel> objectList,
            double prefHeight,
            BooleanSupplier syncingSelectionSupplier,
            Supplier<Consumer<DungeonSelectionItemViewModel>> selectionHandlerSupplier
    ) {
        Objects.requireNonNull(objectList, "objectList");
        Objects.requireNonNull(syncingSelectionSupplier, "syncingSelectionSupplier");
        Objects.requireNonNull(selectionHandlerSupplier, "selectionHandlerSupplier");
        objectList.setPrefHeight(prefHeight);
        objectList.setCellFactory(ignored -> new ListCell<>() {
            @Override
            protected void updateItem(DungeonSelectionItemViewModel item, boolean empty) {
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

    public static @Nullable DungeonSelectionItemViewModel syncSelectionList(
            ListView<DungeonSelectionItemViewModel> objectList,
            @Nullable DungeonLoadedMapViewModel loadedMap,
            @Nullable DungeonSelectionItemViewModel selectedTarget
    ) {
        Objects.requireNonNull(objectList, "objectList");
        List<DungeonSelectionItemViewModel> targets =
                loadedMap == null ? List.of() : loadedMap.selectableTargets();
        objectList.getItems().setAll(targets);
        DungeonSelectionItemViewModel resolved = resolveSelection(targets, selectedTarget);
        if (resolved == null) {
            objectList.getSelectionModel().clearSelection();
        } else {
            objectList.getSelectionModel().select(resolved);
        }
        return resolved;
    }

    private static @Nullable DungeonSelectionItemViewModel resolveSelection(
            List<DungeonSelectionItemViewModel> targets,
            @Nullable DungeonSelectionItemViewModel selectedTarget
    ) {
        if (selectedTarget == null) {
            return null;
        }
        return targets.stream()
                .filter(candidate -> candidate.ownerId() == selectedTarget.ownerId())
                .filter(candidate -> candidate.ownerKind().equalsIgnoreCase(selectedTarget.ownerKind()))
                .filter(candidate -> candidate.partKind().equalsIgnoreCase(selectedTarget.partKind()))
                .findFirst()
                .orElse(null);
    }
}
