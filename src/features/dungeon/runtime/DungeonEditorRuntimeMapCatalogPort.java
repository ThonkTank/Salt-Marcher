package src.features.dungeon.runtime;

import java.util.Objects;

final class DungeonEditorRuntimeMapCatalogPort implements DungeonEditorMapCatalogOperations {
    private final DungeonEditorRuntimeMapCatalogController controller;

    DungeonEditorRuntimeMapCatalogPort(DungeonEditorRuntimeMapCatalogController controller) {
        this.controller = Objects.requireNonNull(controller, "controller");
    }

    @Override
    public void selectMap(long mapIdValue) {
        controller.selectMap(mapIdValue);
    }

    @Override
    public void createMap(String mapName) {
        controller.createMap(mapName);
    }

    @Override
    public void renameMap(long mapIdValue, String mapName) {
        controller.renameMap(mapIdValue, mapName);
    }

    @Override
    public void deleteMap(long mapIdValue) {
        controller.deleteMap(mapIdValue);
    }
}
