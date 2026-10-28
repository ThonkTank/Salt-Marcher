/** Pure canonical payload types shared by transfer and concrete read decoders. No command imports. */
export type world_note = import('../campaign/note-data').Note;
export type character_profile = import('../runtime/live-scene-contracts').CharacterProfile;
export type combat = import('../runtime/combat-state-contracts').CombatState;
export type character_progress = import('../runtime/character-progress-contracts').Progress;
export type treasure = import('../runtime/treasure-contracts').Treasure;
export type character_ledger = import('../runtime/treasure-contracts').LedgerItem;
export type progress_receipt = import('../runtime/progression').ProgressAck;
export type combat_award = import('../runtime/reward-contracts').CombatReward;
export type encounter_plan = import('../catalog/encounter-contracts').StoredEncounterPlan;
export type encounter_table = import('../campaign/generation-contracts').EncounterTable;
export type loot_table = import('../campaign/generation-contracts').LootTable;
export type generator_preset = import('../campaign/generation-contracts').GeneratorPreset;
export type generation_run = import('../campaign/generation-contracts').GenerationRun;
export type world_source = import('../campaign/generation-contracts').WorldSource;
export type npc_record = import('../campaign/npc-data-contracts').NpcRecord;
export type npc_receipt = import('../campaign/npc-data-contracts').NpcView;
export type session_profile = import('../campaign/session-contracts').SessionProfile;
export type session_visit = import('../campaign/session-contracts').VisitDetail;
export type world_actor = import('../campaign/session-contracts').WorldActor;
export type session_run = import('../campaign/session-contracts').SessionRun;
export type session_receipt = import('../campaign/session-contracts').SessionView;
export type shop = import('../catalog/items-contracts').Shop;
export type shop_event = import('../catalog/items-contracts').ShopHistoryEntry;
export type shop_receipt = import('../catalog/items-contracts').ItemShopAck;
export type scene_position = import('../runtime/world-contracts').ScenePosition;
export type world_journey = import('../runtime/world-travel-contracts').Journey;
export type world_receipt = import('../runtime/world-contracts').WorldAck;
export type audio_asset = import('../runtime/music-contracts').AudioAsset;
export type audio_registry = import('../runtime/music-contracts').AudioRegistry;
export type music_state = import('../runtime/music-contracts').MusicState;
export type scene_music = import('../runtime/music-contracts').MusicSceneSettings;
export type music_subject = import('../runtime/music-contracts').MusicSubject;
export type music_receipt = { applied: true };
export type dungeon_feature_state =
  import('../atlas/drawing-view-contracts').DrawingView['features'][number];
export type atlas_landscape = import('../atlas/landscape-contracts').LandscapeRecord;
export type planned_visit =
  import('../../features/planner/manual-planner').ManualPlan['scenes'][number];
export type location = import('../../features/location/location-schema').LocationDocument;
export type live_scene_extra = { readAloud: string };
export type world_record_calendar = import('../runtime/calendar-contracts').FantasyCalendar & {
  id?: string;
};
export type world_record_map = import('../runtime/world-map-contracts').AtlasMap;
export type world_record_phenomenon = import('../runtime/weather-contracts').WeatherPhenomenon;
export type world_record_place_presentation =
  import('../runtime/world-cell-contracts').MarkerPresentation & {
    id: string;
    revision: number;
  };
export type world_record_weather_state = {
  revision: number;
  signature: string;
  mapId?: string | null;
  locationId?: string | null;
};
export type campaign_catalog_receipt =
  import('../campaign/campaign-contracts').CampaignCatalogReceipt;
export type generation_receipt =
  | {
      tables: import('../campaign/generation-contracts').EncounterTable[];
      lootTables: import('../campaign/generation-contracts').LootTable[];
      registry: import('../campaign/generation-contracts').GeneratorRegistry;
    }
  | import('../campaign/generation-contracts').LootRoll
  | import('../catalog/encounter-contracts').EncounterPlan;
export type progress_event = (
  | { entry: import('../runtime/treasure-contracts').LedgerItem; shopId: string }
  | {
      before: import('../runtime/treasure-contracts').LedgerItem;
      portion: import('../runtime/treasure-contracts').LedgerItem;
      shopId: string;
      notes: string;
    }
  | {
      commandId: string;
      combatId: string;
      title: string;
      participant: import('../runtime/combat-state-contracts').Combatant;
      reason: string;
    }
  | { groupId: string; after: import('../campaign/session-contracts').PreparedGroup }
  | {
      groupId: string;
      before: import('../campaign/session-contracts').PreparedGroup;
      after: import('../campaign/session-contracts').PreparedGroup;
    }
  | { treasure: import('../runtime/treasure-contracts').Treasure }
  | {
      treasureId: string;
      from: import('../runtime/treasury-contracts').TreasureAnchor;
      to: import('../runtime/treasury-contracts').TreasureAnchor;
      targetName: string;
      before: import('../runtime/treasure-contracts').Treasure;
      after: import('../runtime/treasure-contracts').Treasure;
      reason: string;
    }
  | {
      treasureId: string;
      before: import('../runtime/treasure-contracts').Treasure;
      after: import('../runtime/treasure-contracts').Treasure;
      reason: string;
    }
  | {
      treasureId: string;
      targetTreasureId: string;
      before: import('../runtime/treasure-contracts').Treasure;
      after: import('../runtime/treasure-contracts').Treasure;
      targetBefore: import('../runtime/treasure-contracts').Treasure;
      targetAfter: import('../runtime/treasure-contracts').Treasure;
      quantity: number;
      itemId: string;
      reason: string;
    }
  | {
      commandId: string;
      combatId: string;
      title: string;
      participant: import('../runtime/combat-state-contracts').Combatant;
      before: import('../runtime/character-progress-contracts').Progress;
      after: import('../runtime/character-progress-contracts').Progress;
    }
  | {
      commandId: string;
      combatId: string;
      title: string;
      participant: import('../runtime/combat-state-contracts').Combatant;
    }
  | {
      sourceKind: string;
      sourceId: string;
      before: import('../runtime/character-progress-contracts').Progress;
      after: import('../runtime/character-progress-contracts').Progress;
      xp: number;
    }
  | {
      awardId: string;
      combatId: string;
      before: import('../runtime/character-progress-contracts').Progress;
      after: import('../runtime/character-progress-contracts').Progress;
      xp: number;
      load: number;
    }
  | {
      treasureId: string;
      itemId: string;
      entry: import('../runtime/treasure-contracts').LedgerItem;
    }
  | {
      before: import('../runtime/character-progress-contracts').Progress;
      after: import('../runtime/character-progress-contracts').Progress;
      xp: number;
      load: number;
      reason: string;
      commandId: string;
    }
  | {
      reason: string;
      recipientIds: string[];
      loadedIds: string[];
      poolXp: number;
      loadXp: number;
      shareXp: number;
      totalXp: number;
      shareLoad: number;
      totalLoad: number;
    }
  | {
      title: string;
      before: import('../runtime/narrative-contracts').NarrativeState;
      after: {
        revision: number;
        awardId: string | null;
        noteId: string;
        status: 'open' | 'closed';
        locationId?: string | null | undefined;
        contributors: string[];
        poolXp: number;
        items: import('../catalog/item-input-contracts').ItemInput[];
      };
    }
  | {
      id: string;
      noteId: import('../../features/campaign/campaign-contracts').CampaignLocalId;
      title: string;
      sceneId: string | null;
      poolXp: number;
      shareXp: number;
      recipientIds: string[];
      treasureId: string | null;
      outcome: string;
      recordedAt: string;
    }
  | {
      before: import('../runtime/treasure-contracts').LedgerItem;
      sourceBefore: import('../runtime/treasure-contracts').LedgerItem;
      after: import('../runtime/treasure-contracts').LedgerItem;
      sourceAfter: import('../runtime/treasure-contracts').LedgerItem;
      reason: string;
    }
  | {
      sourceId: string;
      entry: {
        id: string;
        characterId: string;
        origin: 'transfer';
        rewardCreditId: string;
        parentId: string;
        counterparty: any;
        sourceCharacterId: string;
        provenance: string;
        revision: number;
        reference: import('../catalog/item-input-contracts').ItemReference;
        name: string;
        category: import('../catalog/item-input-contracts').ItemCategory;
        quantity: number;
        unitCopper: string | null;
        status: 'received' | 'sold' | 'given';
        actualSaleCopper: string | null;
        treasureId: string | null;
        combatId: string | null;
        sceneId: string | null;
        locationId: string | null;
        instantMs: string | null;
        recordedAt: string;
        sourceTreasureId?: string | undefined;
        sourceTreasureItemId?: string | undefined;
        creditedCopper?: string | null | undefined;
        recipientCharacterId?: string | undefined;
        sourceNoteId?: string | undefined;
        awardId?: string | undefined;
        mergeTargetId?: string | undefined;
        counterpartyLink?:
          | { kind: 'location' | 'npc' | 'faction' | 'shop'; id: string }
          | undefined;
        paidCopper?: string | undefined;
        instanceId?: string | null | undefined;
        counterpartyReference?:
          | { shopId: string; owner: { kind: 'location' | 'npc'; id: string } }
          | undefined;
        currentName?: string | undefined;
        currentUnitCopper?: string | null | undefined;
        sourceTitle?: string | undefined;
      };
      reason: string;
    }
  | {
      before: import('../runtime/treasure-contracts').LedgerItem;
      after: import('../runtime/treasure-contracts').LedgerItem;
      handed: {
        status: 'given';
        counterparty: any;
        recipientCharacterId: string;
        counterpartyLink: undefined;
        id: string;
        characterId: string;
        revision: number;
        reference: import('../catalog/item-input-contracts').ItemReference;
        name: string;
        category: import('../catalog/item-input-contracts').ItemCategory;
        quantity: number;
        unitCopper: string | null;
        origin: 'purchase' | 'award' | 'manual' | 'transfer';
        actualSaleCopper: string | null;
        treasureId: string | null;
        combatId: string | null;
        sceneId: string | null;
        locationId: string | null;
        instantMs: string | null;
        recordedAt: string;
        parentId: string | null;
        sourceTreasureId?: string | undefined;
        sourceTreasureItemId?: string | undefined;
        rewardCreditId?: string | undefined;
        creditedCopper?: string | null | undefined;
        sourceCharacterId?: string | undefined;
        sourceNoteId?: string | undefined;
        awardId?: string | undefined;
        provenance?: string | undefined;
        mergeTargetId?: string | undefined;
        paidCopper?: string | undefined;
        instanceId?: string | null | undefined;
        counterpartyReference?:
          | { shopId: string; owner: { kind: 'location' | 'npc'; id: string } }
          | undefined;
        currentName?: string | undefined;
        currentUnitCopper?: string | null | undefined;
        sourceTitle?: string | undefined;
      };
      receivedId: string;
      reason: string;
    }
  | {
      before: import('../runtime/treasure-contracts').LedgerItem;
      after: import('../runtime/treasure-contracts').LedgerItem;
      portion: import('../runtime/treasure-contracts').LedgerItem;
      reason: string;
    }
  | {
      reason: string;
      before: import('../runtime/character-progress-contracts').Progress;
      after: import('../runtime/character-progress-contracts').Progress;
      result?: import('../runtime/character-progress-contracts').DeathSaveResult | undefined;
      amount?: number | undefined;
      operation: 'set' | 'damage' | 'heal' | 'death';
    }
  | {
      before: import('../runtime/character-progress-contracts').Progress;
      after: import('../runtime/character-progress-contracts').Progress;
      reason: string;
      mode: 'add' | 'set' | 'subtract';
      requestedAmount: number;
      appliedDelta: number;
      correctionOf: string | null;
    }
  | {
      duration?:
        | { amount: number; unit: import('../runtime/live-scene-contracts').TimeUnit }
        | undefined;
      sceneId?: string | undefined;
      commandId: string;
      rest: 'short' | 'long';
      before: import('../runtime/character-progress-contracts').Progress;
      after: import('../runtime/character-progress-contracts').Progress;
      restoreHp: boolean;
    }
  | { entry: import('../runtime/treasure-contracts').LedgerItem }
  | {
      originalId: string;
      before: import('../runtime/treasure-contracts').LedgerItem;
      after: import('../runtime/treasure-contracts').LedgerItem;
      reason: string;
    }
  | {
      originalId: string;
      before: import('../runtime/treasure-contracts').LedgerItem;
      after: import('../runtime/treasure-contracts').LedgerItem;
      portion: import('../runtime/treasure-contracts').LedgerItem;
      reason: string;
    }
  | { combatId: string; groupId: string; actorIds: string[] }
  | {
      commandId: string;
      combatId: string;
      title: string;
      participant: import('../runtime/combat-state-contracts').Combatant;
      returning: boolean;
    }
) & { recordedAt: string };
export type world_history_facts =
  | {
      before: import('../runtime/calendar-contracts').FantasyCalendar;
      after: import('../runtime/calendar-contracts').FantasyCalendar;
    }
  | { mapId: string }
  | { locationId: string; mapId: string; hex: import('../runtime/world-cell-contracts').Hex }
  | {
      locationId: string;
      presentation: import('../runtime/world-cell-contracts').MarkerPresentation;
    }
  | { phenomenon: import('../runtime/weather-contracts').WeatherPhenomenon }
  | { weather: import('../runtime/weather-contracts').Weather | null }
  | {
      before: import('../runtime/world-contracts').ScenePosition;
      after: Omit<import('../runtime/world-contracts').ScenePosition, 'revision'>;
    }
  | { preview: import('../runtime/world-travel-contracts').TravelPreview; journeyId: string }
  | { journeyId: string }
  | { checkpointId: string; retainedShared: any; from: string; to: string; tables: string[] }
  | {
      journeyId: string;
      ordinal: number;
      actorIds: string[];
      before: {
        position: import('../runtime/world-contracts').ScenePosition;
        clock: { epochId: string; instantMs: string; revision: number };
        weather: import('../runtime/weather-contracts').Weather | null;
      };
      after: {
        position: import('../runtime/world-contracts').ScenePosition;
        clock: { epochId: string; instantMs: string; revision: number };
        weather: import('../runtime/weather-contracts').Weather | null;
      };
      seconds: number;
    }
  | { journeyId: string; hex: import('../runtime/world-cell-contracts').Hex };
export type world_history = {
  text: string;
  recordedAt: string;
  kind?: string;
  combatId?: string;
  facts:
    | party_history_facts
    | { chaseId: string; outcome: string; rounds: number }
    | world_history_facts
    | {
        before: world_source | npc_receipt | npc_record[] | null;
        after: world_source | npc_receipt | npc_record[];
      }
    | {
        kind: 'visit-adopted';
        version: 1;
        adoptionId: string;
        planName: string;
        noteIds: string[];
        readAloud: string;
      }
    | {
        kind: string;
        planId: string;
        sourcePlanId: string | null;
        previousVisitIds: string[];
        visitIds: string[];
      }
    | {
        locationId: string | null;
        beforeLocationId: string | null;
        source: string;
        visitId: string | null;
      };
};
export type party_history_facts =
  | { kind: string; characterIds: string[]; archived: boolean; reason: string }
  | {
      kind: string;
      characterIds: string[];
      active: boolean;
      fromSceneId: string | null;
      toSceneId: string | null;
    }
  | { kind: string; characterIds: string[]; memberIds: string[]; sceneId: string }
  | {
      kind: string;
      characterIds: string[];
      fromSceneId: string;
      toSceneId: string;
      createdScene: boolean;
    }
  | {
      kind: string;
      category: 'combat' | 'narrative' | 'reward' | 'travel' | 'party' | 'world';
      summary: string;
      characterIds: string[];
      locationId: string | null;
      instantMs: string;
      followUpKind: 'quest' | 'rumor' | null;
      followUpId: string | null;
    }
  | {
      kind: string;
      marker: 'start' | 'end';
      summary: string;
      handoff: string;
      characterIds: string[];
      locationId: string | null;
      instantMs: string;
    }
  | {
      kind: string;
      commandId: string;
      adoptionId: string;
      planId: string;
      visitId: string;
      locationId: string | null;
      status: import('../runtime/visit-outcome-contracts').VisitOutcomeStatus;
      outcome: string;
      previous: import('../runtime/visit-outcome-contracts').VisitOutcome | null;
      sceneInstantMs: string;
      characterIds: string[];
    };

export type prepared_group = import('../campaign/session-contracts').PreparedGroup;
