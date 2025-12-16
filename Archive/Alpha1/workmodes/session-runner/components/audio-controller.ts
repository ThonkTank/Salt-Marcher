/**
 * Audio Controller for Session Runner
 *
 * Manages audio playback lifecycle including:
 * - Loading playlists from vault
 * - Creating and managing audio player instances
 * - Auto-selection based on hex context
 * - Manual playlist switching
 * - Volume persistence
 */

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("session-audio-controller");
import {
	selectPlaylist,
	filterPlaylistsByType,
	extractSessionContext,
	createAudioPlayer,
	type SessionContext,
	type AudioPlayer,
} from "@features/audio";
import { readFrontmatter } from "@features/data-manager/browse/frontmatter-utils";
import { LIBRARY_DATA_SOURCES } from "../../library/storage/data-sources";
import { createAudioPanel, type AudioPanelHandle } from "./audio-panel";
import type { PlaylistData } from "../../library/playlists/playlist-types";

export type AudioControllerHandle = {
	readonly panel: AudioPanelHandle;
	updateContext(file: TFile | null, coord: { q: number; r: number } | null): Promise<void>;
	switchToCombatMusic(): Promise<void>;
	restorePreviousMusic(): Promise<void>;
	dispose(): void;
};

type AudioControllerOptions = {
	app: App;
	host: HTMLElement;
};

export async function createAudioController(options: AudioControllerOptions): Promise<AudioControllerHandle> {
	const { app, host } = options;

	// Audio players
	let ambiencePlayer: AudioPlayer | null = null;
	let musicPlayer: AudioPlayer | null = null;

	// Playlist cache
	let availablePlaylists: PlaylistData[] = [];
	let currentContext: SessionContext | null = null;
	let currentAmbiencePlaylist: PlaylistData | null = null;
	let currentMusicPlaylist: PlaylistData | null = null;

	// Volume settings (persist across sessions)
	let ambienceVolume = 0.7;
	let musicVolume = 0.7;

	// Combat music state
	let previousMusicPlaylist: PlaylistData | null = null;
	let inCombat = false;

	// Create panel
	const panel = createAudioPanel(host, {
		onPlaylistSelect: (playlistId: string, type: "ambience" | "music") => {
			const playlist = availablePlaylists.find((p) => p.name === playlistId);
			if (!playlist) {
				logger.warn("[AudioController] Playlist not found", { playlistId });
				return;
			}
			void loadPlaylist(playlist, type);
		},
		onVolumeChange: (volume: number, type: "ambience" | "music") => {
			if (type === "ambience") {
				ambienceVolume = volume;
			} else {
				musicVolume = volume;
			}
		},
		onSkipForward: (type: "ambience" | "music") => {
			const player = type === "ambience" ? ambiencePlayer : musicPlayer;
			if (player) {
				const status = player.getStatus();
				if (status && status.currentTrack) {
					const currentTime = status.currentTrack.position || 0;
					void player.seek(currentTime + 10);
				}
			}
		},
		onSkipBack: (type: "ambience" | "music") => {
			const player = type === "ambience" ? ambiencePlayer : musicPlayer;
			if (player) {
				const status = player.getStatus();
				if (status && status.currentTrack) {
					const currentTime = status.currentTrack.position || 0;
					void player.seek(Math.max(0, currentTime - 10));
				}
			}
		},
		onToggleAuto: (type: "ambience" | "music") => {
			// When auto-select is toggled, trigger auto-selection if enabled
			if (currentContext) {
				void autoSelectPlaylists(currentContext);
			}
		},
	});

	// Initialize players
	ambiencePlayer = createAudioPlayer();
	musicPlayer = createAudioPlayer();

	// Set initial volumes
	ambiencePlayer.setGlobalVolume(ambienceVolume);
	musicPlayer.setGlobalVolume(musicVolume);

	// Connect players to panel
	panel.setAmbiencePlayer(ambiencePlayer);
	panel.setMusicPlayer(musicPlayer);

	// Load available playlists
	await loadPlaylists();

	/**
	 * Load all playlists from vault
	 */
	async function loadPlaylists(): Promise<void> {
		try {
			const dataSource = LIBRARY_DATA_SOURCES.playlists;
			const files = await dataSource.list(app);

			const playlists: PlaylistData[] = [];
			for (const file of files) {
				try {
					const fm = await readFrontmatter(app, file);
					const playlist = frontmatterToPlaylist(fm);
					if (playlist) {
						playlists.push(playlist);
					}
				} catch (error) {
					logger.error("[AudioController] Failed to load playlist", { file: file.path, error });
				}
			}

			availablePlaylists = playlists;

			// Update panel with playlists
			const ambience = filterPlaylistsByType(playlists, "ambience");
			const music = filterPlaylistsByType(playlists, "music");
			panel.setPlaylists(ambience, music);

			logger.info("[AudioController] Loaded playlists", {
				total: playlists.length,
				ambience: ambience.length,
				music: music.length,
			});
		} catch (error) {
			logger.error("[AudioController] Failed to load playlists", { error });
		}
	}

	/**
	 * Convert frontmatter to PlaylistData
	 */
	function frontmatterToPlaylist(fm: Record<string, unknown>): PlaylistData | null {
		// Required fields
		const name = typeof fm.name === "string" ? fm.name : null;
		const type =
			typeof fm.type === "string" && (fm.type === "ambience" || fm.type === "music")
				? fm.type
				: "ambience";
		const tracks = Array.isArray(fm.tracks) ? fm.tracks : [];

		if (!name) {
			return null;
		}

		// Helper to extract token values
		const extractTokens = (raw: unknown): Array<{ value: string }> => {
			if (!Array.isArray(raw)) return [];
			return raw
				.map((entry) => {
					if (typeof entry === "string" && entry.trim()) {
						return { value: entry.trim() };
					}
					if (entry && typeof entry === "object") {
						const value = (entry as Record<string, unknown>).value;
						if (typeof value === "string" && value.trim()) {
							return { value: value.trim() };
						}
					}
					return null;
				})
				.filter((v): v is { value: string } => v !== null);
		};

		return {
			name,
			display_name: typeof fm.display_name === "string" ? fm.display_name : undefined,
			type,
			description: typeof fm.description === "string" ? fm.description : undefined,
			terrain_tags: extractTokens(fm.terrain_tags),
			weather_tags: extractTokens(fm.weather_tags),
			time_of_day_tags: extractTokens(fm.time_of_day_tags),
			faction_tags: extractTokens(fm.faction_tags),
			situation_tags: extractTokens(fm.situation_tags),
			shuffle: typeof fm.shuffle === "boolean" ? fm.shuffle : undefined,
			loop: typeof fm.loop === "boolean" ? fm.loop : undefined,
			crossfade_duration:
				typeof fm.crossfade_duration === "number" ? fm.crossfade_duration : undefined,
			default_volume: typeof fm.default_volume === "number" ? fm.default_volume : undefined,
			tracks,
		};
	}

	/**
	 * Load and play a playlist
	 */
	async function loadPlaylist(playlist: PlaylistData, type: "ambience" | "music"): Promise<void> {
		try {
			const player = type === "ambience" ? ambiencePlayer : musicPlayer;
			if (!player) {
				logger.warn("[AudioController] No player available", { type });
				return;
			}

			// Update current playlist tracking
			if (type === "ambience") {
				currentAmbiencePlaylist = playlist;
			} else {
				currentMusicPlaylist = playlist;
			}

			// Load playlist into player
			player.loadPlaylist(playlist);

			// Apply default volume if specified
			if (playlist.default_volume !== undefined) {
				player.setGlobalVolume(playlist.default_volume);
			}

			// Auto-play
			await player.play();

			logger.info("[AudioController] Loaded playlist", {
				type,
				playlist: playlist.name,
				tracks: playlist.tracks.length,
			});
		} catch (error) {
			logger.error("[AudioController] Failed to load playlist", { playlist: playlist.name, error });
		}
	}

	/**
	 * Update context and trigger auto-selection
	 */
	async function updateContext(
		file: TFile | null,
		coord: { q: number; r: number } | null,
	): Promise<void> {
		try {
			// Extract context from current hex
			if (!file || !coord) {
				currentContext = null;
				panel.setContext(null);
				return;
			}

			const context = await extractSessionContext(app, file, coord);
			currentContext = context;
			panel.setContext(context);

			// Auto-select playlists based on context
			await autoSelectPlaylists(context);
		} catch (error) {
			logger.error("[AudioController] Failed to update context", { error });
		}
	}

	/**
	 * Auto-select playlists based on context
	 */
	async function autoSelectPlaylists(context: SessionContext): Promise<void> {
		try {
			// Filter playlists by type
			const ambiencePlaylists = filterPlaylistsByType(availablePlaylists, "ambience");
			const musicPlaylists = filterPlaylistsByType(availablePlaylists, "music");

			// Select best matching playlists
			const ambienceResult = selectPlaylist(ambiencePlaylists, context);
			const musicResult = selectPlaylist(musicPlaylists, context);

			// Load ambience playlist if different from current
			if (ambienceResult.selected && ambienceResult.selected.name !== currentAmbiencePlaylist?.name) {
				await loadPlaylist(ambienceResult.selected, "ambience");
			}

			// Load music playlist if different from current
			if (musicResult.selected && musicResult.selected.name !== currentMusicPlaylist?.name) {
				await loadPlaylist(musicResult.selected, "music");
			}

			logger.info("[AudioController] Auto-selected playlists", {
				ambience: ambienceResult.selected?.name ?? "none",
				ambienceScore: ambienceResult.score,
				music: musicResult.selected?.name ?? "none",
				musicScore: musicResult.score,
			});
		} catch (error) {
			logger.error("[AudioController] Auto-selection failed", { error });
		}
	}

	/**
	 * Switch to combat music
	 */
	async function switchToCombatMusic(): Promise<void> {
		if (inCombat) {
			logger.info("[AudioController] Already in combat, skipping music switch");
			return;
		}

		try {
			// Save current music playlist
			previousMusicPlaylist = currentMusicPlaylist;
			inCombat = true;

			// Filter to combat music
			const musicPlaylists = filterPlaylistsByType(availablePlaylists, "music");
			const combatContext: SessionContext = {
				...currentContext,
				situation: "combat", // Override situation to combat
			};

			const combatResult = selectPlaylist(musicPlaylists, combatContext);

			if (combatResult.selected) {
				await loadPlaylist(combatResult.selected, "music");
				logger.info("[AudioController] Switched to combat music", {
					playlist: combatResult.selected.name,
					score: combatResult.score,
				});
			} else {
				logger.warn("[AudioController] No combat music found");
			}
		} catch (error) {
			logger.error("[AudioController] Failed to switch to combat music", { error });
		}
	}

	/**
	 * Restore previous music after combat
	 */
	async function restorePreviousMusic(): Promise<void> {
		if (!inCombat) {
			logger.info("[AudioController] Not in combat, skipping restore");
			return;
		}

		try {
			inCombat = false;

			if (previousMusicPlaylist) {
				await loadPlaylist(previousMusicPlaylist, "music");
				logger.info("[AudioController] Restored previous music", {
					playlist: previousMusicPlaylist.name,
				});
			} else {
				// Re-run auto-selection based on current context
				if (currentContext) {
					const musicPlaylists = filterPlaylistsByType(availablePlaylists, "music");
					const musicResult = selectPlaylist(musicPlaylists, currentContext);

					if (musicResult.selected) {
						await loadPlaylist(musicResult.selected, "music");
						logger.info("[AudioController] Auto-selected music after combat", {
							playlist: musicResult.selected.name,
						});
					}
				}
			}

			previousMusicPlaylist = null;
		} catch (error) {
			logger.error("[AudioController] Failed to restore previous music", { error });
		}
	}

	/**
	 * Dispose of audio controller and cleanup resources
	 */
	function dispose(): void {
		try {
			if (ambiencePlayer) {
				ambiencePlayer.stop();
				ambiencePlayer.dispose();
				ambiencePlayer = null;
			}
			if (musicPlayer) {
				musicPlayer.stop();
				musicPlayer.dispose();
				musicPlayer = null;
			}
			panel.destroy();
			logger.info("[AudioController] Disposed");
		} catch (error) {
			logger.error("[AudioController] Disposal failed", { error });
		}
	}

	return {
		panel,
		updateContext,
		switchToCombatMusic,
		restorePreviousMusic,
		dispose,
	};
}
