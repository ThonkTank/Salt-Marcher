package src.view.leftbartabs.worldplanner;

record WorldPlannerStateViewInputEvent(
        int activeModuleIndex,
        NpcSnapshot npc,
        FactionSnapshot faction,
        LocationSnapshot location,
        ActionSnapshot actions
) {

    WorldPlannerStateViewInputEvent {
        activeModuleIndex = Math.max(0, activeModuleIndex);
        npc = npc == null ? new NpcSnapshot("", -1, "", "", "", "") : npc;
        faction = faction == null ? new FactionSnapshot("", -1, -1, -1, false, "") : faction;
        location = location == null ? new LocationSnapshot("", -1, -1) : location;
        actions = actions == null
                ? new ActionSnapshot(false, false, false, false, false, false, false, false, false)
                : actions;
    }

    record NpcSnapshot(
            String displayName,
            int statblockChoiceIndex,
            String appearanceNotes,
            String behaviorNotes,
            String historyNotes,
            String generalNotes
    ) {

        NpcSnapshot {
            displayName = displayName == null ? "" : displayName;
            statblockChoiceIndex = Math.max(-1, statblockChoiceIndex);
            appearanceNotes = appearanceNotes == null ? "" : appearanceNotes;
            behaviorNotes = behaviorNotes == null ? "" : behaviorNotes;
            historyNotes = historyNotes == null ? "" : historyNotes;
            generalNotes = generalNotes == null ? "" : generalNotes;
        }
    }

    record FactionSnapshot(
            String displayName,
            int primaryEncounterTableChoiceIndex,
            int npcChoiceIndex,
            int inventoryStatblockChoiceIndex,
            boolean finiteInventory,
            String inventoryQuantityText
    ) {

        FactionSnapshot {
            displayName = displayName == null ? "" : displayName;
            primaryEncounterTableChoiceIndex = Math.max(-1, primaryEncounterTableChoiceIndex);
            npcChoiceIndex = Math.max(-1, npcChoiceIndex);
            inventoryStatblockChoiceIndex = Math.max(-1, inventoryStatblockChoiceIndex);
            inventoryQuantityText = inventoryQuantityText == null ? "" : inventoryQuantityText;
        }
    }

    record LocationSnapshot(
            String displayName,
            int factionChoiceIndex,
            int encounterTableChoiceIndex
    ) {

        LocationSnapshot {
            displayName = displayName == null ? "" : displayName;
            factionChoiceIndex = Math.max(-1, factionChoiceIndex);
            encounterTableChoiceIndex = Math.max(-1, encounterTableChoiceIndex);
        }
    }

    record ActionSnapshot(
            boolean createRequested,
            boolean saveNotesRequested,
            boolean defeatRequested,
            boolean reactivateRequested,
            boolean addToEncounterRequested,
            boolean addNpcRequested,
            boolean setInventoryLimitRequested,
            boolean linkFactionRequested,
            boolean linkTableRequested
    ) {

    }
}
