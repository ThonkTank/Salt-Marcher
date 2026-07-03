package src.view.leftbartabs.worldplanner;

record WorldPlannerLocationMainViewInputEvent(
        boolean createRequested,
        boolean linkFactionRequested,
        boolean linkTableRequested,
        int selectedLocationIndex,
        String locationDisplayName,
        int factionChoiceIndex,
        int encounterTableChoiceIndex
) {
    WorldPlannerLocationMainViewInputEvent {
        selectedLocationIndex = Math.max(-1, selectedLocationIndex);
        locationDisplayName = locationDisplayName == null ? "" : locationDisplayName;
        factionChoiceIndex = Math.max(-1, factionChoiceIndex);
        encounterTableChoiceIndex = Math.max(-1, encounterTableChoiceIndex);
    }
}
