// Canonical payload types used by the campaign transfer contracts.
export type room = Pick<import('../shared/contracts').Room, 'polygons' | 'sections'>;
export type history =
  | import('../shared/contracts').Room
  | { kind: 'drawing'; scope: 'shared'; version: 1 };
export type room_draft = import('../shared/contracts').WorkingRoomDraft;
export type world_note = import('../storage/stored-record-types').world_note;
export type preparation_draft = import('../campaign/preparation-contracts').PreparationDraft;
export type character_profile = import('../storage/stored-record-types').character_profile;
export type live_receipt = import('../runtime/live-contracts').LiveAck;
export type live_moment_draft = import('../runtime/live-moment-drafts').LiveMomentDraft;
export type combat = import('../storage/stored-record-types').combat;
export type combat_undo = import('../runtime/combat-contracts').CombatState;
export type combat_receipt = import('../runtime/combat-contracts').CombatView;
export type combat_working_draft = import('../runtime/combat-draft-contracts').CombatWorkingDraft;
export type chase = import('../runtime/chase-contracts').ChaseState;
export type chase_receipt = import('../runtime/chase-contracts').ChaseView;
export type chase_working_draft = import('../runtime/chase-draft-contracts').ChaseWorkingDraft;
export type mask_reconciliation_receipt =
  import('../storage/mask-reconciliation').MaskReconciliationReceipt;
export type scene_rule_pin = import('../catalog/rule-reference-contracts').SceneRulePin;
export type scene_rule_receipt = import('../catalog/rule-reference-contracts').SceneRules;
export type scene_check = import('../runtime/scene-check-contracts').SceneCheck;
export type scene_check_receipt = import('../runtime/scene-check-contracts').SceneCheck;
export type character_progress = import('../storage/stored-record-types').character_progress;
export type treasure = import('../storage/stored-record-types').treasure;
export type character_ledger = import('../storage/stored-record-types').character_ledger;
export type progress_receipt = import('../storage/stored-record-types').progress_receipt;
export type combat_award = import('../storage/stored-record-types').combat_award;
export type encounter_plan = import('../storage/stored-record-types').encounter_plan;
export type encounter_plan_receipt = import('../catalog/encounter-contracts').EncounterPlan;
export type encounter_table = import('../storage/stored-record-types').encounter_table;
export type loot_table = import('../storage/stored-record-types').loot_table;
export type generator_preset = import('../storage/stored-record-types').generator_preset;
export type generation_run = import('../storage/stored-record-types').generation_run;
export type world_source = import('../storage/stored-record-types').world_source;
export type generator_registry_receipt = import('../campaign/generation-contracts').PresetReceipt;
export type npc_record = import('../storage/stored-record-types').npc_record;
export type npc_draft = import('../campaign/npc-contracts').NpcDraft;
export type npc_receipt = import('../storage/stored-record-types').npc_receipt;
export type session_profile = import('../storage/stored-record-types').session_profile;
export type session_visit = import('../storage/stored-record-types').session_visit;
export type prepared_group = import('../storage/stored-record-types').prepared_group;
export type world_actor = import('../storage/stored-record-types').world_actor;
export type session_run = import('../storage/stored-record-types').session_run;
export type session_receipt = import('../storage/stored-record-types').session_receipt;
export type item_definition = import('../catalog/items-contracts').ItemDefinition;
export type item_definition_version = import('../catalog/items-contracts').ItemDefinition;
export type shop = import('../storage/stored-record-types').shop;
export type shop_event = import('../storage/stored-record-types').shop_event;
export type shop_receipt = import('../storage/stored-record-types').shop_receipt;
export type scene_position = import('../storage/stored-record-types').scene_position;
export type world_journey = import('../storage/stored-record-types').world_journey;
export type world_receipt = import('../storage/stored-record-types').world_receipt;
export type audio_asset = import('../storage/stored-record-types').audio_asset;
export type audio_registry = import('../storage/stored-record-types').audio_registry;
export type music_state = import('../storage/stored-record-types').music_state;
export type scene_music = import('../storage/stored-record-types').scene_music;
export type music_subject = import('../storage/stored-record-types').music_subject;
export type music_receipt = import('../storage/stored-record-types').music_receipt;
export type city_document = import('../atlas/city-contracts').CityHeader;
export type city_unit = import('../atlas/city-contracts').CityUnit;
export type player_asset = import('../runtime/player-contracts').PlayerAsset;
export type npc_route = import('../runtime/autonomy-contracts').NpcRoute;
export type autonomy_actor = import('../runtime/autonomy-contracts').AutonomyActor;
export type autonomy_job = import('../runtime/autonomy-contracts').AutonomyJob;
export type drawing_profile = import('../atlas/drawing-contracts').RoomStyle;
export type drawing_element = import('../atlas/drawing-contracts').DrawingElement;
export type dungeon_feature_state = import('../storage/stored-record-types').dungeon_feature_state;
export type dungeon_travel_settings = import('../runtime/dungeon-pace').DungeonPaceSettings;
export type dungeon_journey = import('../atlas/dungeon-contracts').DungeonJourney;
export type npc_dungeon_position = import('../atlas/dungeon-contracts').DungeonPose;
export type dungeon_track = import('../atlas/dungeon-contracts').DungeonTrace;
export type dungeon_trace = import('../atlas/dungeon-contracts').DungeonTrace;
export type dungeon_trace_rules = import('../atlas/dungeon-contracts').DungeonTraceRules;
export type dungeon_volume = import('../atlas/volume-contracts').DungeonVolume;
export type dungeon_path = import('../atlas/path-contracts').DungeonPath;
export type dungeon_passage = import('../atlas/path-contracts').DungeonPassage;
export type dungeon_key_content = import('../campaign/key-contracts').KeyContent;
export type dungeon_graph_layout = import('../atlas/graph-contracts').GraphLayout;
export type dungeon_trigger_field = import('../runtime/trigger-contracts').TriggerField;
export type dungeon_trigger_event = import('../runtime/trigger-contracts').TriggerEvent;
export type dungeon_content_state = import('../runtime/content-runtime-contracts').ContentState;
export type narrative_state = import('../runtime/narrative-contracts').NarrativeState;
export type narrative_award = import('../runtime/narrative-contracts').NarrativeAward;
export type narrative_draft = import('../runtime/narrative-contracts').NarrativeDraft;
export type finish_draft = import('../runtime/finish-draft-contracts').FinishDraft;
export type scene_creation_draft = import('../runtime/scene-desk-contracts').SceneCreationDraft;
export type scene_desk = import('../shared/desk-reference').DeskRef[];
export type treasury_draft = import('../runtime/treasury-contracts').TreasuryDraft;
export type group_draft = import('../campaign/groups-contracts').GroupDraft;
export type world_relation_pair_draft =
  import('../campaign/world-relation-pair-contracts').WorldRelationPairDraft;
export type world_relation_pair_receipt =
  import('../campaign/world-relation-pair-contracts').WorldRelationPairAck;
export type world_relation_pair_history_receipt =
  import('../campaign/world-relation-pair-contracts').WorldRelationPairHistoryView;
export type atlas_entrance = import('../atlas/atlas-travel-contracts').AtlasEntrance;
export type atlas_local_journey = import('../atlas/atlas-travel-contracts').AtlasLocalJourney;
export type atlas_landscape = import('../storage/stored-record-types').atlas_landscape;
export type atlas_territory_layer = import('../atlas/atlas-territories').AtlasTerritoryLayer;
export type atlas_territory = import('../atlas/atlas-territories').AtlasTerritory;
export type room_group = {
  id: string;
  recipe: import('../atlas/room-group-generator').GroupRecipe;
  protected: boolean;
};

// Storage envelopes that have no public renderer representation.
export type planned_visit = import('../storage/stored-record-types').planned_visit;
export type location = import('../storage/stored-record-types').location;
export type live_scene_extra = import('../storage/stored-record-types').live_scene_extra;
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
export type world_record_calendar = import('../storage/stored-record-types').world_record_calendar;
export type world_record_map = import('../storage/stored-record-types').world_record_map;
export type world_record_calendar_event = import('../runtime/world-contracts').CalendarEvent;
export type world_record_phenomenon =
  import('../storage/stored-record-types').world_record_phenomenon;
export type world_record_place_presentation =
  import('../storage/stored-record-types').world_record_place_presentation;
export type world_record_weather_state =
  import('../storage/stored-record-types').world_record_weather_state;
export type world_record_weather_override = {
  revision: number;
  id: string;
  enabled: boolean;
  weather: import('../runtime/world-contracts').Weather | null;
};
export type player_record_settings = import('../runtime/player-contracts').PlayerSettings;
export type player_record_observer = import('../runtime/player-contracts').PlayerObserver & {
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
export type campaign_catalog_receipt =
  import('../storage/stored-record-types').campaign_catalog_receipt;
export type dungeon_memory = { polygons: import('../shared/contracts').Polygon[] };
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
export type generation_receipt = import('../storage/stored-record-types').generation_receipt;
export type scene_time_step = {
  epochId: string;
  from: string;
  to: string;
  beforeRevision: number;
  afterRevision: number;
  calendarVersion: string;
  amount?: number;
  unit?: import('../runtime/live-contracts').TimeUnit;
  calendar?: { revision: number; daySeconds: number };
  eventTarget?: import('../runtime/time-plan-contracts').ClockEventTarget;
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
  fromHex: import('../runtime/world-contracts').Hex;
  toHex: import('../runtime/world-contracts').Hex;
  effects: { table: string; before: unknown; after: unknown }[];
};

export type progress_event = import('../storage/stored-record-types').progress_event;

export type world_history_facts = import('../storage/stored-record-types').world_history_facts;

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
    routes?: import('../runtime/autonomy-contracts').NpcRoute[];
    places?: (string | null)[];
    dungeon?: import('../runtime/autonomy-contracts').AutonomyDungeonTravel;
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
export type world_history = import('../storage/stored-record-types').world_history;
export type settings_preparation = import('../campaign/preparation-contracts').PreparationSelection;
export type settings_session_recap = import('../runtime/live-contracts').SessionRecapDraft;

export type npc_dailyPlan = import('../campaign/npc-contracts').NpcDailySlot[];
export type npc_dailyOverrides = import('../campaign/npc-contracts').NpcDailyOverride[];

export type world_record_projection = { epoch: string };
export type world_record_environment = { revision: number };

export type party_history_facts = import('../storage/stored-record-types').party_history_facts;
