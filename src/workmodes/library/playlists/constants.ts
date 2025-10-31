/**
 * Playlist Constants
 *
 * Preset tags and options for playlist filtering and configuration.
 */

export const PLAYLIST_TYPES = [
	{ value: "ambience", label: "Ambience" },
	{ value: "music", label: "Music" },
] as const;

export const TERRAIN_TAGS = [
	"Forest",
	"Mountain",
	"Desert",
	"Swamp",
	"Coastal",
	"Ocean",
	"Arctic",
	"Cave",
	"Underground",
	"Urban",
	"Ruins",
	"Plains",
	"Hills",
	"Jungle",
	"Volcanic",
] as const;

export const WEATHER_TAGS = [
	"Clear",
	"Cloudy",
	"Rain",
	"Storm",
	"Snow",
	"Fog",
	"Wind",
	"Hot",
	"Cold",
] as const;

export const TIME_OF_DAY_TAGS = [
	"Dawn",
	"Morning",
	"Noon",
	"Afternoon",
	"Dusk",
	"Evening",
	"Night",
	"Midnight",
] as const;

export const FACTION_TAGS = [
	"Friendly",
	"Neutral",
	"Hostile",
	"Undead",
	"Fey",
	"Fiend",
	"Celestial",
	"Elemental",
	"Dragon",
	"Giant",
	"Humanoid",
	"Beast",
] as const;

export const SITUATION_TAGS = [
	"Exploration",
	"Combat",
	"Social",
	"Stealth",
	"Chase",
	"Rest",
	"Tension",
	"Mystery",
	"Horror",
	"Celebration",
	"Travel",
	"Dungeon",
	"Boss",
	"Victory",
	"Defeat",
] as const;

export const DEFAULT_CROSSFADE_DURATION = 2; // seconds
export const DEFAULT_VOLUME = 0.7;
