package src.view.leftbartabs.worldplanner;

record WorldPlannerControlsViewInputEvent(
        int selectedModuleIndex,
        boolean refreshRequested
) {
    WorldPlannerControlsViewInputEvent {
        selectedModuleIndex = Math.max(0, selectedModuleIndex);
    }
}
