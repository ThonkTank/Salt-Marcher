// Canonical payload types used by the campaign transfer contracts.
export type room = Pick<import('../contracts').Room, 'polygons' | 'sections'>;
export type history =
  | import('../contracts').Room
  | { kind: 'drawing'; scope: 'shared'; version: 1 };
export type room_draft = import('../contracts').WorkingRoomDraft;
export type world_note = import('../preparation-contracts').Note;
export type preparation_draft = import('../preparation-contracts').PreparationDraft;
export type character_profile = import('../live-contracts').CharacterProfile;
export type live_receipt = import('../live-contracts').LiveAck;
export type live_moment_draft = import('../live-moment-drafts').LiveMomentDraft;
export type combat = import('../combat-contracts').CombatState;
export type combat_undo = import('../combat-contracts').CombatState;
export type combat_receipt = import('../combat-contracts').CombatView;
export type combat_working_draft = import('../combat-draft-contracts').CombatWorkingDraft;
export type chase = import('../chase-contracts').ChaseState;
export type chase_receipt = import('../chase-contracts').ChaseView;
export type chase_working_draft = import('../chase-draft-contracts').ChaseWorkingDraft;
export type mask_reconciliation_receipt =
  import('../storage/mask-reconciliation').MaskReconciliationReceipt;
export type scene_rule_pin = import('../rule-reference-contracts').SceneRulePin;
export type scene_rule_receipt = import('../rule-reference-contracts').SceneRules;
export type scene_check = import('../scene-check-contracts').SceneCheck;
export type scene_check_receipt = import('../scene-check-contracts').SceneCheck;
export type character_progress = import('../progression').Progress;
export type treasure = import('../progression').Treasure;
export type character_ledger = import('../progression').LedgerItem;
export type progress_receipt = import('../progression').ProgressAck;
export type combat_award = import('../progression').CombatReward;
export type encounter_plan = import('../encounter-contracts').EncounterPlan;
export type encounter_plan_receipt = import('../encounter-contracts').EncounterPlan;
export type encounter_table = import('../generation-contracts').EncounterTable;
export type loot_table = import('../generation-contracts').LootTable;
export type generator_preset = import('../generation-contracts').GeneratorPreset;
export type generation_run = import('../generation-contracts').GenerationRun;
export type world_source = import('../generation-contracts').WorldSource;
export type generator_registry_receipt = import('../generation-contracts').PresetReceipt;
export type npc_record = import('../npc-contracts').NpcRecord;
export type npc_draft = import('../npc-contracts').NpcDraft;
export type npc_receipt = import('../npc-contracts').NpcView;
export type session_profile = import('../session-contracts').SessionProfile;
export type session_visit = import('../session-contracts').VisitDetail;
export type prepared_group = import('../session-contracts').PreparedGroup;
export type world_actor = import('../session-contracts').WorldActor;
export type session_run = import('../session-contracts').SessionRun;
export type session_receipt = import('../session-contracts').SessionView;
export type item_definition = import('../items-contracts').ItemDefinition;
export type item_definition_version = import('../items-contracts').ItemDefinition;
export type shop = import('../items-contracts').Shop;
export type shop_event = import('../items-contracts').ShopHistoryEntry;
export type shop_receipt = import('../items-contracts').ItemShopAck;
export type scene_position = import('../world-contracts').ScenePosition;
export type world_journey = import('../world-contracts').Journey;
export type world_receipt = import('../world-contracts').WorldAck;
export type audio_asset = import('../music-contracts').AudioAsset;
export type audio_registry = import('../music-contracts').AudioRegistry;
export type music_state = import('../music-contracts').MusicState;
export type scene_music = import('../music-contracts').MusicSceneSettings;
export type music_subject = import('../music-contracts').MusicSubject;
export type music_receipt = { applied: true };
export type city_document = import('../atlas/city-contracts').CityHeader;
export type city_unit = import('../atlas/city-contracts').CityUnit;
export type player_asset = import('../player-contracts').PlayerAsset;
export type npc_route = import('../autonomy-contracts').NpcRoute;
export type autonomy_actor = import('../autonomy-contracts').AutonomyActor;
export type autonomy_job = import('../autonomy-contracts').AutonomyJob;
export type drawing_profile = import('../atlas/drawing-contracts').RoomStyle;
export type drawing_element = import('../atlas/drawing-contracts').DrawingElement;
export type dungeon_feature_state = import('../atlas/drawing-contracts').DrawingView['features'][number];
export type dungeon_travel_settings = import('../dungeon-pace').DungeonPaceSettings;
export type dungeon_journey = import('../atlas/dungeon-contracts').DungeonJourney;
export type npc_dungeon_position = import('../atlas/dungeon-contracts').DungeonPose;
export type dungeon_track = import('../atlas/dungeon-contracts').DungeonTrace;
export type dungeon_trace = import('../atlas/dungeon-contracts').DungeonTrace;
export type dungeon_trace_rules = import('../atlas/dungeon-contracts').DungeonTraceRules;
export type dungeon_volume = import('../atlas/volume-contracts').DungeonVolume;
export type dungeon_path = import('../atlas/path-contracts').DungeonPath;
export type dungeon_passage = import('../atlas/path-contracts').DungeonPassage;
export type dungeon_key_content = import('../key-contracts').KeyContent;
export type dungeon_graph_layout = import('../atlas/graph-contracts').GraphLayout;
export type dungeon_trigger_field = import('../trigger-contracts').TriggerField;
export type dungeon_trigger_event = import('../trigger-contracts').TriggerEvent;
export type dungeon_content_state = import('../content-runtime-contracts').ContentState;
export type narrative_state = import('../narrative-contracts').NarrativeState;
export type narrative_award = import('../narrative-contracts').NarrativeAward;
export type narrative_draft = import('../narrative-contracts').NarrativeDraft;
export type finish_draft = import('../finish-draft-contracts').FinishDraft;
export type scene_creation_draft = import('../scene-desk-contracts').SceneCreationDraft;
export type scene_desk = import('../scene-desk-contracts').DeskRef[];
export type treasury_draft = import('../treasury-contracts').TreasuryDraft;
export type group_draft = import('../groups-contracts').GroupDraft;
export type world_relation_pair_draft =
  import('../world-relation-pair-contracts').WorldRelationPairDraft;
export type world_relation_pair_receipt =
  import('../world-relation-pair-contracts').WorldRelationPairAck;
export type world_relation_pair_history_receipt =
  import('../world-relation-pair-contracts').WorldRelationPairHistoryView;
export type atlas_entrance = import('../atlas/atlas-travel-contracts').AtlasEntrance;
export type atlas_local_journey = import('../atlas/atlas-travel-contracts').AtlasLocalJourney;
export type atlas_landscape = import('../atlas/atlas-landscape').LandscapeRecord;
export type atlas_territory_layer = import('../atlas/atlas-territories').AtlasTerritoryLayer;
export type atlas_territory = import('../atlas/atlas-territories').AtlasTerritory;
export type room_group = {
  id: string;
  recipe: import('../atlas/room-group-generator').GroupRecipe;
  protected: boolean;
};

// Storage envelopes that have no public renderer representation.
export type planned_visit =
  import('../../features/planner/manual-planner').ManualPlan['scenes'][number];
export type location = import('../../features/location/location-schema').LocationDocument;
export type live_scene_extra = { readAloud: string };
export type note_source_history = { sourceId: string; before: world_note; after: world_note };
export type city_history = {
  id: string;
  label: string;
  cityId: string;
  before: (city_unit | { id: string; deleted: boolean })[];
  after: (city_unit | { id: string; deleted: boolean })[];
  beforeHeader: city_document;
  afterHeader: city_document;
  applied: boolean;
};
export type player_hex_memory = {
  q: number;
  r: number;
  terrain: string;
  elevationM?: number;
  road: boolean;
  river: boolean;
  mapRevision: number;
};
export type player_discovery = {
  publicLabel: string;
  position?: { mapId: string; q: number; r: number; revision: number } | null;
  confirmationRevision?: number;
};
export type world_record_calendar = import('../world-contracts').FantasyCalendar & { id?: string };
export type world_record_map = import('../world-contracts').AtlasMap;
export type world_record_calendar_event = import('../world-contracts').CalendarEvent;
export type world_record_phenomenon = import('../world-contracts').WeatherPhenomenon;
export type world_record_place_presentation = import('../world-contracts').MarkerPresentation & {
  id: string;
  revision: number;
};
export type world_record_weather_state = {
  revision: number;
  signature: string;
  mapId?: string | null;
  locationId?: string | null;
};
export type world_record_weather_override = {
  revision: number;
  id: string;
  enabled: boolean;
  weather: import('../world-contracts').Weather | null;
};
export type player_record_settings = import('../player-contracts').PlayerSettings;
export type player_record_observer = import('../player-contracts').PlayerObserver & {
  revision: number;
};
export type player_record_mask = {
  mapId: string;
  q: number;
  r: number;
  hidden: boolean;
  blocksSight: boolean;
  publicLabel: string;
  revision: number;
};
export type world_relation_pair_history = {
  version: 1;
  ordinal: number;
  operation: 'add' | 'remove';
  sourceId: string;
  targetId: string;
  forwardLabel: string;
  reverseLabel: string;
  forwardFamilyKind?: string;
  reverseFamilyKind?: string;
  afterSourceRevision: number;
  afterTargetRevision: number;
  undoSourceRevision: number | null;
  undoTargetRevision: number | null;
};
export type campaign_catalog_receipt = import('../campaign-contracts').CampaignCatalogReceipt;
export type dungeon_memory = { polygons: import('../contracts').Polygon[] };
export type dungeon_slice_memory = dungeon_memory;
export type dungeon_track_adjustment = { dc: number; hidden: boolean; publicText: string };
export type dungeon_npc_knowledge = {
  known: boolean;
  visible?: boolean;
  heard?: boolean;
  profile?: string;
};
export type dungeon_sense_settings = {
  activeScore: number | null;
  hearingMeters: number;
  trackDcOverride: number | null;
};
export type dungeon_signal = {
  id: string;
  pose: import('../atlas/dungeon-contracts').DungeonPose;
  epochId: string;
  instantMs: string;
  publicText: string;
  rangeMeters: number;
  dc: number;
  durationSeconds: number;
  actorId: string | null;
  sceneId: string | null;
  profile: string;
};
export type dungeon_perception = {
  known: boolean;
  visible: boolean;
  heard: boolean;
  override: string | null;
  publicText?: string;
  dc?: number;
  sourceKnown?: boolean;
  sourceActorId?: string | null;
  from?: import('../atlas/dungeon-contracts').DungeonPose;
  to?: import('../atlas/dungeon-contracts').DungeonPose;
  profile?: string;
};
export type dungeon_content_signal = {
  revision: number;
  lastVisible: boolean;
  lastDetected: boolean;
  pending: boolean;
  reason: string;
};
export type autonomy_receipt = { progressed: number; pending: number };
export type generation_receipt =
  | {
      tables: import('../generation-contracts').EncounterTable[];
      lootTables: import('../generation-contracts').LootTable[];
      registry: import('../generation-contracts').GeneratorRegistry;
    }
  | import('../generation-contracts').LootRoll
  | import('../encounter-contracts').EncounterPlan;
export type scene_time_step = {
  epochId: string;
  from: string;
  to: string;
  beforeRevision: number;
  afterRevision: number;
  calendarVersion: string;
  amount?: number;
  unit?: import('../live-contracts').TimeUnit;
  calendar?: { revision: number; daySeconds: number };
  eventTarget?: import('../time-plan-contracts').ClockEventTarget;
  reason: string;
  recordedAt: string;
  checkpointId?: string;
  direction?: 'undo' | 'redo';
};
export type drawing_history = {
  label: string;
  changes: {
    key: { table: string; id: string; scopeId?: string; kind?: string };
    before: unknown;
    after: unknown;
    guard: string;
  }[];
};
export type travel_checkpoint = {
  version: 1;
  id: string;
  sceneId: string;
  journeyId: string;
  commandId: string;
  ordinal: number;
  actorIds: string[];
  membershipRevision: number;
  epochId: string;
  from: string;
  to: string;
  fromHex: import('../world-contracts').Hex;
  toHex: import('../world-contracts').Hex;
  effects: { table: string; before: unknown; after: unknown }[];
};

export type progress_event = (
  | { entry: import('../progression').LedgerItem; shopId: string }
  | {
      before: import('../progression').LedgerItem;
      portion: import('../progression').LedgerItem;
      shopId: string;
      notes: string;
    }
  | {
      commandId: string;
      combatId: string;
      title: string;
      participant: import('../combat-contracts').Combatant;
      reason: string;
    }
  | { groupId: string; after: import('../session-contracts').PreparedGroup }
  | {
      groupId: string;
      before: import('../session-contracts').PreparedGroup;
      after: import('../session-contracts').PreparedGroup;
    }
  | { treasure: import('../progression').Treasure }
  | {
      treasureId: string;
      from: import('../treasury-contracts').TreasureAnchor;
      to: import('../treasury-contracts').TreasureAnchor;
      targetName: string;
      before: import('../progression').Treasure;
      after: import('../progression').Treasure;
      reason: string;
    }
  | {
      treasureId: string;
      before: import('../progression').Treasure;
      after: import('../progression').Treasure;
      reason: string;
    }
  | {
      treasureId: string;
      targetTreasureId: string;
      before: import('../progression').Treasure;
      after: import('../progression').Treasure;
      targetBefore: import('../progression').Treasure;
      targetAfter: import('../progression').Treasure;
      quantity: number;
      itemId: string;
      reason: string;
    }
  | {
      commandId: string;
      combatId: string;
      title: string;
      participant: import('../combat-contracts').Combatant;
      before: import('../progression').Progress;
      after: import('../progression').Progress;
    }
  | {
      commandId: string;
      combatId: string;
      title: string;
      participant: import('../combat-contracts').Combatant;
    }
  | {
      sourceKind: string;
      sourceId: string;
      before: import('../progression').Progress;
      after: import('../progression').Progress;
      xp: number;
    }
  | {
      awardId: string;
      combatId: string;
      before: import('../progression').Progress;
      after: import('../progression').Progress;
      xp: number;
      load: number;
    }
  | { treasureId: string; itemId: string; entry: import('../progression').LedgerItem }
  | {
      before: import('../progression').Progress;
      after: import('../progression').Progress;
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
      before: import('../narrative-contracts').NarrativeState;
      after: {
        revision: number;
        awardId: string | null;
        noteId: string;
        status: 'open' | 'closed';
        locationId?: string | null | undefined;
        contributors: string[];
        poolXp: number;
        items: import('../progression').ItemInput[];
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
      before: import('../progression').LedgerItem;
      sourceBefore: import('../progression').LedgerItem;
      after: import('../progression').LedgerItem;
      sourceAfter: import('../progression').LedgerItem;
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
        reference: import('../progression').ItemReference;
        name: string;
        category: import('../progression').ItemCategory;
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
      before: import('../progression').LedgerItem;
      after: import('../progression').LedgerItem;
      handed: {
        status: 'given';
        counterparty: any;
        recipientCharacterId: string;
        counterpartyLink: undefined;
        id: string;
        characterId: string;
        revision: number;
        reference: import('../progression').ItemReference;
        name: string;
        category: import('../progression').ItemCategory;
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
      before: import('../progression').LedgerItem;
      after: import('../progression').LedgerItem;
      portion: import('../progression').LedgerItem;
      reason: string;
    }
  | {
      reason: string;
      before: import('../progression').Progress;
      after: import('../progression').Progress;
      result?: import('../progression').DeathSaveResult | undefined;
      amount?: number | undefined;
      operation: 'set' | 'damage' | 'heal' | 'death';
    }
  | {
      before: import('../progression').Progress;
      after: import('../progression').Progress;
      reason: string;
      mode: 'add' | 'set' | 'subtract';
      requestedAmount: number;
      appliedDelta: number;
      correctionOf: string | null;
    }
  | {
      duration?: { amount: number; unit: import('../live-contracts').TimeUnit } | undefined;
      sceneId?: string | undefined;
      commandId: string;
      rest: 'short' | 'long';
      before: import('../progression').Progress;
      after: import('../progression').Progress;
      restoreHp: boolean;
    }
  | { entry: import('../progression').LedgerItem }
  | {
      originalId: string;
      before: import('../progression').LedgerItem;
      after: import('../progression').LedgerItem;
      reason: string;
    }
  | {
      originalId: string;
      before: import('../progression').LedgerItem;
      after: import('../progression').LedgerItem;
      portion: import('../progression').LedgerItem;
      reason: string;
    }
  | { combatId: string; groupId: string; actorIds: string[] }
  | {
      commandId: string;
      combatId: string;
      title: string;
      participant: import('../combat-contracts').Combatant;
      returning: boolean;
    }
) & { recordedAt: string };

export type world_history_facts =
  | {
      before: import('../world-contracts').FantasyCalendar;
      after: import('../world-contracts').FantasyCalendar;
    }
  | { mapId: string }
  | { locationId: string; mapId: string; hex: import('../world-contracts').Hex }
  | { locationId: string; presentation: import('../world-contracts').MarkerPresentation }
  | { phenomenon: import('../world-contracts').WeatherPhenomenon }
  | { weather: import('../world-contracts').Weather | null }
  | {
      before: import('../world-contracts').ScenePosition;
      after: Omit<import('../world-contracts').ScenePosition, 'revision'>;
    }
  | { preview: import('../world-contracts').TravelPreview; journeyId: string }
  | { journeyId: string }
  | { checkpointId: string; retainedShared: any; from: string; to: string; tables: string[] }
  | {
      journeyId: string;
      ordinal: number;
      actorIds: string[];
      before: {
        position: import('../world-contracts').ScenePosition;
        clock: { epochId: string; instantMs: string; revision: number };
        weather: import('../world-contracts').Weather | null;
      };
      after: {
        position: import('../world-contracts').ScenePosition;
        clock: { epochId: string; instantMs: string; revision: number };
        weather: import('../world-contracts').Weather | null;
      };
      seconds: number;
    }
  | { journeyId: string; hex: import('../world-contracts').Hex };

export type dungeon_perception_log_facts =
  | { actorId: string | null; rules: import('../atlas/dungeon-contracts').DungeonTraceRules }
  | { traceId: string; actorId: string | null; sourceKnown: boolean }
  | { actorIds: string[] }
  | { subjectId: string | null; score: any; hearingMeters: any; profile: string };

export type AutonomyPosition = {
  locationId: string | null;
  revision: number | null;
  dungeon?: import('../atlas/dungeon-contracts').DungeonPose | null;
};
export type autonomy_log_facts = {
  reason?: string;
  jobId?: string | null;
  previousJobId?: string;
  progressSeconds?: number;
  position?: AutonomyPosition | import('../atlas/dungeon-contracts').DungeonPose | null;
  epochId?: string;
  actorInstantMs?: string;
  sceneInstantMs?: string;
  before?: AutonomyPosition;
  after?: AutonomyPosition;
  beforePosition?: AutonomyPosition | null;
  currentPosition?: AutonomyPosition;
  expectedPosition?: AutonomyPosition | null;
  confirmedPosition?: AutonomyPosition | null;
  excluded?: string[];
  excludedRemaining?: number;
  seconds?: number;
  priority?: number | null;
  considered?: { jobId: string; name: string; priority: number | null; reason: string }[];
  consideredRemaining?: number;
  tieBreak?: string;
  waypoint?: number;
  featureId?: string;
  roomId?: string;
  locationId?: string;
  targetActorId?: string;
  roll?: number;
  bonus?: number;
  defense?: number;
  damage?: number;
  beforeHp?: number;
  afterHp?: number;
  routeIds?: string[];
  needEffects?: Record<string, number>;
  groupId?: string;
  groupRevision?: number;
  enabled?: boolean;
  cursor?: number;
  offsetSeconds?: number;
  jobRestarted?: boolean;
  partySceneIds?: string[];
  route?: {
    id?: string;
    seconds: number;
    routes?: import('../autonomy-contracts').NpcRoute[];
    places?: (string | null)[];
    dungeon?: import('../autonomy-contracts').AutonomyDungeonTravel;
  };
};

export type autonomy_log = {
  id: string;
  actorId: string;
  intervalId: string;
  kind: string;
  text: string;
  facts: autonomy_log_facts;
};
export type dungeon_perception_log = {
  id: string;
  text: string;
  facts: dungeon_perception_log_facts;
};
export type autonomy_interval = Omit<
  ReturnType<typeof import('../storage/autonomy').captureAutonomyBasis>,
  'features'
> & { features: { id: string; revision: number }[] };
export type autonomy_dungeon_basis = {
  owners: {
    scopeId: string;
    locationId: string | null;
    triggerFields: { id: string; revision: number }[];
    rooms: { id: string; revision: number }[];
    elements: { id: string; revision: number }[];
    paths: { id: string; revision: number }[];
    passages: { id: string; revision: number }[];
    volumes: { id: string; revision: number }[];
    styles: { id: string; revision: number }[];
    floors: { id: string; elevation: number }[];
    hidden: { id: string; kind: string; hidden: number; revision: number }[];
  };
  geometry: import('../atlas/dungeon-contracts').DungeonGeometry;
};
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
export type settings_preparation = import('../preparation-contracts').PreparationSelection;
export type settings_session_recap = import('../live-contracts').SessionRecapDraft;

export type npc_dailyPlan = import('../npc-contracts').NpcDailySlot[];
export type npc_dailyOverrides = import('../npc-contracts').NpcDailyOverride[];

export type world_record_projection = { epoch: string };
export type world_record_environment = { revision: number };

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
      status: import('../visit-outcome-contracts').VisitOutcomeStatus;
      outcome: string;
      previous: import('../visit-outcome-contracts').VisitOutcome | null;
      sceneInstantMs: string;
      characterIds: string[];
    };
