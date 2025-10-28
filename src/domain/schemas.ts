/**
 * Shared schema definitions for Salt Marcher domain documents.
 * 
 * These runtime validators are intentionally lightweight so they can run inside
 * DevKit tooling without requiring a full build step. They focus on validating
 * required fields and basic shape guarantees.
 */

export interface SchemaLocation {
    /** Relative path from the plugin root where documents reside. */
    root: string;
    /** Whether the directory may be absent without causing a validation error. */
    optional?: boolean;
    /** Currently all schemas expect Markdown with YAML frontmatter. */
    format?: 'frontmatter-md';
}

export interface SchemaDocument {
    frontmatter: Record<string, unknown>;
    body: string;
    filePath: string;
}

export interface SchemaValidationError {
    field: string;
    message: string;
}

export type SchemaValidator = (doc: SchemaDocument) => SchemaValidationError[];

export interface SchemaDefinition {
    name: string;
    description: string;
    locations: SchemaLocation[];
    validate: SchemaValidator;
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function ensureString(fm: Record<string, unknown>, field: string, errors: SchemaValidationError[], options: { required?: boolean } = {}) {
    const value = fm[field];
    if (value == null || value === '') {
        if (options.required) {
            errors.push({ field, message: 'Field is required.' });
        }
        return;
    }
    if (typeof value !== 'string') {
        errors.push({ field, message: 'Expected string.' });
    }
}

function ensureStringArray(fm: Record<string, unknown>, field: string, errors: SchemaValidationError[]) {
    const value = fm[field];
    if (value == null) return;
    if (!Array.isArray(value)) {
        errors.push({ field, message: 'Expected array of strings.' });
        return;
    }
    for (const entry of value) {
        if (typeof entry !== 'string') {
            errors.push({ field, message: 'Array must contain strings only.' });
            break;
        }
    }
}

function ensureNumber(fm: Record<string, unknown>, field: string, errors: SchemaValidationError[], options: { required?: boolean; min?: number } = {}) {
    const value = fm[field];
    if (value == null) {
        if (options.required) {
            errors.push({ field, message: 'Field is required.' });
        }
        return;
    }
    if (typeof value !== 'number' || Number.isNaN(value)) {
        errors.push({ field, message: 'Expected number.' });
        return;
    }
    if (options.min !== undefined && value < options.min) {
        errors.push({ field, message: `Number must be >= ${options.min}.` });
    }
}

function ensureObjectArray(value: unknown, field: string, errors: SchemaValidationError[]) {
    if (value == null) return;
    if (!Array.isArray(value)) {
        errors.push({ field, message: 'Expected array of objects.' });
        return;
    }
    for (const entry of value) {
        if (typeof entry !== 'object' || entry === null) {
            errors.push({ field, message: 'Array must contain objects.' });
            break;
        }
    }
}

function ensureTokenArray(value: unknown, field: string, errors: SchemaValidationError[]): void {
    if (value == null) return;
    if (!Array.isArray(value)) {
        errors.push({ field, message: 'Expected array of token entries.' });
        return;
    }
    for (const entry of value) {
        if (typeof entry === 'string') {
            if (!entry.trim()) {
                errors.push({ field, message: 'Token values must be non-empty strings.' });
                break;
            }
        } else if (!entry || typeof entry !== 'object' || typeof (entry as Record<string, unknown>).value !== 'string' || !(entry as Record<string, unknown>).value.trim()) {
            errors.push({ field, message: 'Token entries must include a string "value" property.' });
            break;
        }
    }
}

function ensureBoolean(value: unknown, field: string, errors: SchemaValidationError[]) {
    if (value == null) return;
    if (typeof value !== 'boolean') {
        errors.push({ field, message: 'Expected boolean.' });
    }
}

// ---------------------------------------------------------------------------
// Schema-specific validators
// ---------------------------------------------------------------------------

export interface FactionDocument {
    name: string;
    motto?: string;
    headquarters?: string;
    territory?: string;
    influence_tags?: Array<{ value: string }>;
    culture_tags?: Array<{ value: string }>;
    goal_tags?: Array<{ value: string }>;
    summary?: string;
    assets?: string;
    relationships?: string;
    members?: Array<{ name: string; role?: string; status?: string; is_named?: boolean; notes?: string }>;
}

export function validateFaction(doc: SchemaDocument): SchemaValidationError[] {
    const fm = doc.frontmatter ?? {};
    const errors: SchemaValidationError[] = [];

    ensureString(fm, 'name', errors, { required: true });
    ensureString(fm, 'motto', errors);
    ensureString(fm, 'headquarters', errors);
    ensureString(fm, 'territory', errors);
    ensureString(fm, 'summary', errors);
    ensureString(fm, 'assets', errors);
    ensureString(fm, 'relationships', errors);

    ensureTokenArray(fm.influence_tags, 'influence_tags', errors);
    ensureTokenArray(fm.culture_tags, 'culture_tags', errors);
    ensureTokenArray(fm.goal_tags, 'goal_tags', errors);

    const members = fm.members;
    if (members !== undefined) {
        if (!Array.isArray(members)) {
            errors.push({ field: 'members', message: 'Members must be an array of objects.' });
        } else {
            members.forEach((entry, index) => {
                const prefix = `members[${index}]`;
                if (!entry || typeof entry !== 'object') {
                    errors.push({ field: prefix, message: 'Member entry must be an object.' });
                    return;
                }
                const record = entry as Record<string, unknown>;
                ensureString(record, 'name', errors, { required: true });
                ensureString(record, 'role', errors);
                ensureString(record, 'status', errors);
                ensureBoolean(record.is_named, `${prefix}.is_named`, errors);
                ensureString(record, 'notes', errors);
            });
        }
    }

    return errors;
}

export interface PlaceDocument {
    id: string;
    name: string;
    kind?: string;
    parentId?: string;
    owner?: string;
    tags?: string[];
    influence?: { radius?: number; strength?: number };
    links?: Array<{ type: string; target: string }>;
    notes?: string;
    version?: number;
}

export function validatePlace(doc: SchemaDocument): SchemaValidationError[] {
    const fm = doc.frontmatter ?? {};
    const errors: SchemaValidationError[] = [];
    ensureString(fm, 'id', errors, { required: true });
    ensureString(fm, 'name', errors, { required: true });
    ensureString(fm, 'kind', errors);
    ensureString(fm, 'parentId', errors);
    ensureString(fm, 'owner', errors);
    ensureStringArray(fm, 'tags', errors);

    if (fm.influence && typeof fm.influence === 'object') {
        const inf = fm.influence as Record<string, unknown>;
        ensureNumber(inf, 'radius', errors, { min: 0 });
        ensureNumber(inf, 'strength', errors, { min: 0 });
    }

    if (fm.links !== undefined) {
        ensureObjectArray(fm.links, 'links', errors);
        if (Array.isArray(fm.links)) {
            fm.links.forEach((entry, index) => {
                if (entry && typeof entry === 'object') {
                    ensureString(entry as Record<string, unknown>, 'type', errors, { required: true });
                    ensureString(entry as Record<string, unknown>, 'target', errors, { required: true });
                } else {
                    errors.push({ field: `links[${index}]`, message: 'Expected object.' });
                }
            });
        }
    }
    return errors;
}

export interface DungeonDocument {
    id: string;
    name: string;
    parentId?: string;
    kind?: string;
    grid?: { columns: number; rows: number; tileSize: number };
    rooms?: Array<{
        id: string;
        name: string;
        summary?: string;
        sensory?: Record<string, string>;
        features?: Array<{ id: string; label: string; name: string; tag?: string; leadsTo?: string; description?: string }>;
    }>;
    tokens?: Array<{ id: string; label: string; kind: string; position: { x: number; y: number } }>;
    fog?: { enabled?: boolean; revealedRooms?: string[] };
    version?: number;
}

export function validateDungeon(doc: SchemaDocument): SchemaValidationError[] {
    const fm = doc.frontmatter ?? {};
    const errors: SchemaValidationError[] = [];

    ensureString(fm, 'id', errors, { required: true });
    ensureString(fm, 'name', errors, { required: true });

    if (fm.grid !== undefined) {
        if (typeof fm.grid !== 'object' || fm.grid === null) {
            errors.push({ field: 'grid', message: 'Expected object.' });
        } else {
            const grid = fm.grid as Record<string, unknown>;
            ensureNumber(grid, 'columns', errors, { required: true, min: 1 });
            ensureNumber(grid, 'rows', errors, { required: true, min: 1 });
            ensureNumber(grid, 'tileSize', errors, { required: true, min: 1 });
        }
    }

    if (fm.rooms !== undefined) {
        ensureObjectArray(fm.rooms, 'rooms', errors);
        if (Array.isArray(fm.rooms)) {
            fm.rooms.forEach((room, index) => {
                if (room && typeof room === 'object') {
                    ensureString(room as Record<string, unknown>, 'id', errors, { required: true });
                    ensureString(room as Record<string, unknown>, 'name', errors, { required: true });
                    const features = (room as Record<string, unknown>).features;
                    if (features !== undefined) {
                        ensureObjectArray(features, `rooms[${index}].features`, errors);
                        if (Array.isArray(features)) {
                            features.forEach((feature, fIndex) => {
                                if (feature && typeof feature === 'object') {
                                    ensureString(feature as Record<string, unknown>, 'id', errors, { required: true });
                                    ensureString(feature as Record<string, unknown>, 'label', errors, { required: true });
                                    ensureString(feature as Record<string, unknown>, 'name', errors, { required: true });
                                } else {
                                    errors.push({ field: `rooms[${index}].features[${fIndex}]`, message: 'Expected object.' });
                                }
                            });
                        }
                    }
                } else {
                    errors.push({ field: `rooms[${index}]`, message: 'Expected object.' });
                }
            });
        }
    }

    if (fm.tokens !== undefined) {
        ensureObjectArray(fm.tokens, 'tokens', errors);
        if (Array.isArray(fm.tokens)) {
            fm.tokens.forEach((token, index) => {
                if (token && typeof token === 'object') {
                    ensureString(token as Record<string, unknown>, 'id', errors, { required: true });
                    ensureString(token as Record<string, unknown>, 'label', errors, { required: true });
                    ensureString(token as Record<string, unknown>, 'kind', errors, { required: true });
                    const position = (token as Record<string, unknown>).position;
                    if (!position || typeof position !== 'object') {
                        errors.push({ field: `tokens[${index}].position`, message: 'Position object required.' });
                    } else {
                        ensureNumber(position as Record<string, unknown>, 'x', errors, { required: true });
                        ensureNumber(position as Record<string, unknown>, 'y', errors, { required: true });
                    }
                } else {
                    errors.push({ field: `tokens[${index}]`, message: 'Expected object.' });
                }
            });
        }
    }

    if (fm.fog && typeof fm.fog === 'object') {
        const fog = fm.fog as Record<string, unknown>;
        if (fog.revealedRooms !== undefined && !Array.isArray(fog.revealedRooms)) {
            errors.push({ field: 'fog.revealedRooms', message: 'Expected array of strings.' });
        }
    }

    return errors;
}

export interface PlaylistDocument {
    id: string;
    name: string;
    summary?: string;
    tags?: string[];
    allowShuffle?: boolean;
    fade?: { in?: number; out?: number };
    tracks?: Array<{ id: string; title: string; url: string; weight?: number }>;
    rules?: Array<{ when?: Record<string, string>; action?: string; trackId?: string }>;
    version?: number;
}

export function validatePlaylist(doc: SchemaDocument): SchemaValidationError[] {
    const fm = doc.frontmatter ?? {};
    const errors: SchemaValidationError[] = [];
    ensureString(fm, 'id', errors, { required: true });
    ensureString(fm, 'name', errors, { required: true });
    ensureStringArray(fm, 'tags', errors);

    if (fm.fade && typeof fm.fade === 'object') {
        const fade = fm.fade as Record<string, unknown>;
        ensureNumber(fade, 'in', errors, { min: 0 });
        ensureNumber(fade, 'out', errors, { min: 0 });
    }

    if (fm.tracks !== undefined) {
        ensureObjectArray(fm.tracks, 'tracks', errors);
        if (Array.isArray(fm.tracks)) {
            fm.tracks.forEach((track, index) => {
                if (track && typeof track === 'object') {
                    ensureString(track as Record<string, unknown>, 'id', errors, { required: true });
                    ensureString(track as Record<string, unknown>, 'title', errors, { required: true });
                    ensureString(track as Record<string, unknown>, 'url', errors, { required: true });
                    const weight = (track as Record<string, unknown>).weight;
                    if (weight !== undefined && (typeof weight !== 'number' || weight < 0)) {
                        errors.push({ field: `tracks[${index}].weight`, message: 'Weight must be a non-negative number.' });
                    }
                } else {
                    errors.push({ field: `tracks[${index}]`, message: 'Expected object.' });
                }
            });
        }
    }

    return errors;
}

export interface CalendarEventDocument {
    id: string;
    title: string;
    summary?: string;
    tags?: string[];
    schedule: {
        type: 'single' | 'recurring';
        calendar?: string;
        date?: string;
        intervalDays?: number;
        offsetDay?: number;
    };
    triggers?: Array<Record<string, unknown>>;
    effects?: Array<Record<string, unknown>>;
    version?: number;
}

export function validateCalendarEvent(doc: SchemaDocument): SchemaValidationError[] {
    const fm = doc.frontmatter ?? {};
    const errors: SchemaValidationError[] = [];
    ensureString(fm, 'id', errors, { required: true });
    ensureString(fm, 'title', errors, { required: true });
    ensureStringArray(fm, 'tags', errors);

    const schedule = fm.schedule;
    if (!schedule || typeof schedule !== 'object') {
        errors.push({ field: 'schedule', message: 'Schedule object required.' });
    } else {
        const sched = schedule as Record<string, unknown>;
        ensureString(sched, 'type', errors, { required: true });
        const type = typeof sched.type === 'string' ? sched.type : '';
        if (type === 'recurring') {
            ensureNumber(sched, 'intervalDays', errors, { required: true, min: 1 });
            ensureNumber(sched, 'offsetDay', errors, { min: 0 });
        } else if (type === 'single') {
            ensureString(sched, 'date', errors, { required: true });
        }
    }

    return errors;
}

export interface LootTemplateDocument {
    id: string;
    name: string;
    tags?: string[];
    xpRange?: { min: number; max: number };
    gold?: { base?: number; perCharacter?: number };
    items?: Array<Record<string, unknown>>;
    inherentLoot?: { applyFraction?: number; notes?: string };
    version?: number;
}

export function validateLootTemplate(doc: SchemaDocument): SchemaValidationError[] {
    const fm = doc.frontmatter ?? {};
    const errors: SchemaValidationError[] = [];
    ensureString(fm, 'id', errors, { required: true });
    ensureString(fm, 'name', errors, { required: true });
    ensureStringArray(fm, 'tags', errors);

    if (fm.xpRange && typeof fm.xpRange === 'object') {
        const range = fm.xpRange as Record<string, unknown>;
        ensureNumber(range, 'min', errors, { min: 0 });
        ensureNumber(range, 'max', errors, { min: 0 });
    }

    if (fm.gold && typeof fm.gold === 'object') {
        const gold = fm.gold as Record<string, unknown>;
        ensureNumber(gold, 'base', errors, { min: 0 });
        ensureNumber(gold, 'perCharacter', errors, { min: 0 });
    }

    if (fm.inherentLoot && typeof fm.inherentLoot === 'object') {
        const inherent = fm.inherentLoot as Record<string, unknown>;
        ensureNumber(inherent, 'applyFraction', errors, { min: 0 });
        ensureString(inherent, 'notes', errors);
    }

    return errors;
}

export const SCHEMA_DEFINITIONS: SchemaDefinition[] = [
    {
        name: 'Faction',
        description: 'Faction documents with membership and influence.',
        locations: [
            { root: 'samples/fraktionen', format: 'frontmatter-md', optional: true }
        ],
        validate: validateFaction
    },
    {
        name: 'Place',
        description: 'Location hierarchy entries (cities, districts, buildings).',
        locations: [
            { root: 'samples/orte', format: 'frontmatter-md', optional: true }
        ],
        validate: validatePlace
    },
    {
        name: 'Dungeon',
        description: 'Dungeon configuration with grid/rooms/tokens.',
        locations: [
            { root: 'samples/dungeons', format: 'frontmatter-md', optional: true }
        ],
        validate: validateDungeon
    },
    {
        name: 'Playlist',
        description: 'Audio playlist definitions with tracks and rules.',
        locations: [
            { root: 'samples/playlists', format: 'frontmatter-md', optional: true }
        ],
        validate: validatePlaylist
    },
    {
        name: 'Calendar Event',
        description: 'Timed events that interact with the Almanac.',
        locations: [
            { root: 'samples/events', format: 'frontmatter-md', optional: true }
        ],
        validate: validateCalendarEvent
    },
    {
        name: 'Loot Template',
        description: 'Loot configurations driven by encounter XP.',
        locations: [
            { root: 'samples/loot', format: 'frontmatter-md', optional: true }
        ],
        validate: validateLootTemplate
    }
];
