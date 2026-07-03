package src.view.leftbartabs.worldplanner;

record WorldPlannerFactionMainViewInputEvent(
        boolean createRequested,
        boolean addNpcRequested,
        boolean setInventoryLimitRequested,
        int selectedFactionIndex,
        String factionDisplayName,
        int primaryEncounterTableChoiceIndex,
        int npcChoiceIndex,
        int inventoryStatblockChoiceIndex,
        boolean finiteInventory,
        String inventoryQuantityText
) {
    WorldPlannerFactionMainViewInputEvent {
        selectedFactionIndex = Math.max(-1, selectedFactionIndex);
        factionDisplayName = factionDisplayName == null ? "" : factionDisplayName;
        primaryEncounterTableChoiceIndex = Math.max(-1, primaryEncounterTableChoiceIndex);
        npcChoiceIndex = Math.max(-1, npcChoiceIndex);
        inventoryStatblockChoiceIndex = Math.max(-1, inventoryStatblockChoiceIndex);
        inventoryQuantityText = inventoryQuantityText == null ? "" : inventoryQuantityText;
    }
}
