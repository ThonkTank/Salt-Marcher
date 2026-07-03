package src.view.leftbartabs.worldplanner;

record WorldPlannerNpcMainViewInputEvent(
        boolean createRequested,
        boolean saveNotesRequested,
        boolean defeatRequested,
        boolean reactivateRequested,
        boolean addToEncounterRequested,
        int selectedNpcIndex,
        String npcDisplayName,
        int statblockChoiceIndex,
        String appearanceNotes,
        String behaviorNotes,
        String historyNotes,
        String generalNotes
) {
    WorldPlannerNpcMainViewInputEvent {
        selectedNpcIndex = Math.max(-1, selectedNpcIndex);
        npcDisplayName = npcDisplayName == null ? "" : npcDisplayName;
        statblockChoiceIndex = Math.max(-1, statblockChoiceIndex);
        appearanceNotes = appearanceNotes == null ? "" : appearanceNotes;
        behaviorNotes = behaviorNotes == null ? "" : behaviorNotes;
        historyNotes = historyNotes == null ? "" : historyNotes;
        generalNotes = generalNotes == null ? "" : generalNotes;
    }
}
