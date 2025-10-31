/**
 * Audio Panel Component for Session Runner
 *
 * Provides UI controls for audio playback with automatic playlist selection
 * based on hex context (terrain, weather, time, faction, situation).
 *
 * Features:
 * - Dual players (ambience + music)
 * - Auto-selection based on session context
 * - Manual playlist override
 * - Playback controls (play/pause/skip/volume)
 * - Current track display
 */

import { setIcon } from "obsidian";
import type { AudioPlayer, PlaybackStatus } from "../../../features/audio/types";
import type { PlaylistData } from "../../library/playlists/types";
import type { SessionContext } from "../../../features/audio/auto-selection-types";
import { applyMapButtonStyle } from "../../../ui/maps/workflows/map-workflows";

export type AudioPanelCallbacks = {
	onPlaylistSelect: (playlistId: string, type: "ambience" | "music") => void;
	onVolumeChange: (volume: number, type: "ambience" | "music") => void;
};

export type AudioPanelHandle = {
	readonly root: HTMLElement;
	setPlaylists(ambience: PlaylistData[], music: PlaylistData[]): void;
	setContext(context: SessionContext | null): void;
	setAmbiencePlayer(player: AudioPlayer | null): void;
	setMusicPlayer(player: AudioPlayer | null): void;
	destroy(): void;
};

type PlayerPanelState = {
	player: AudioPlayer | null;
	statusUnsubscribe: (() => void) | null;
	currentPlaylist: PlaylistData | null;
};

export function createAudioPanel(host: HTMLElement, callbacks: AudioPanelCallbacks): AudioPanelHandle {
	const root = host.createDiv({ cls: "sm-audio-panel" });

	// Header
	const header = root.createDiv({ cls: "sm-audio-panel__header" });
	header.createEl("h3", { text: "Audio", cls: "sm-audio-panel__title" });

	// Context display
	const contextDisplay = root.createDiv({ cls: "sm-audio-panel__context" });
	const contextTags = contextDisplay.createDiv({ cls: "sm-audio-panel__context-tags" });

	// Ambience section
	const ambienceSection = root.createDiv({ cls: "sm-audio-panel__section" });
	const ambienceState: PlayerPanelState = {
		player: null,
		statusUnsubscribe: null,
		currentPlaylist: null,
	};
	const ambienceControls = createPlayerPanel(
		ambienceSection,
		"Ambience",
		"ambience",
		ambienceState,
		callbacks,
	);

	// Music section
	const musicSection = root.createDiv({ cls: "sm-audio-panel__section" });
	const musicState: PlayerPanelState = {
		player: null,
		statusUnsubscribe: null,
		currentPlaylist: null,
	};
	const musicControls = createPlayerPanel(musicSection, "Music", "music", musicState, callbacks);

	// Available playlists state
	let availableAmbience: PlaylistData[] = [];
	let availableMusic: PlaylistData[] = [];

	const setPlaylists = (ambience: PlaylistData[], music: PlaylistData[]) => {
		availableAmbience = ambience;
		availableMusic = music;
		ambienceControls.updatePlaylistDropdown(ambience);
		musicControls.updatePlaylistDropdown(music);
	};

	const setContext = (context: SessionContext | null) => {
		if (!context) {
			contextTags.empty();
			contextTags.createSpan({ text: "No context", cls: "sm-audio-panel__context-tag--empty" });
			return;
		}

		contextTags.empty();

		// Helper to add tag
		const addTag = (value: string, category: string) => {
			const tag = contextTags.createSpan({
				cls: `sm-audio-panel__context-tag sm-audio-panel__context-tag--${category}`,
				text: value,
			});
			tag.title = category;
		};

		// Display active tags
		if (context.terrain) addTag(context.terrain, "terrain");
		if (context.weather) addTag(context.weather, "weather");
		if (context.timeOfDay) addTag(context.timeOfDay, "time");
		if (context.situation) addTag(context.situation, "situation");
		if (context.factions && context.factions.length > 0) {
			context.factions.forEach((f) => addTag(f, "faction"));
		}

		if (contextTags.childElementCount === 0) {
			contextTags.createSpan({ text: "No tags", cls: "sm-audio-panel__context-tag--empty" });
		}
	};

	const setAmbiencePlayer = (player: AudioPlayer | null) => {
		if (ambienceState.statusUnsubscribe) {
			ambienceState.statusUnsubscribe();
			ambienceState.statusUnsubscribe = null;
		}
		ambienceState.player = player;
		if (player) {
			ambienceState.statusUnsubscribe = player.onStatusChange((status) => {
				ambienceControls.updateStatus(status);
			});
			ambienceControls.updateStatus(player.getStatus());
		} else {
			ambienceControls.updateStatus(null);
		}
	};

	const setMusicPlayer = (player: AudioPlayer | null) => {
		if (musicState.statusUnsubscribe) {
			musicState.statusUnsubscribe();
			musicState.statusUnsubscribe = null;
		}
		musicState.player = player;
		if (player) {
			musicState.statusUnsubscribe = player.onStatusChange((status) => {
				musicControls.updateStatus(status);
			});
			musicControls.updateStatus(player.getStatus());
		} else {
			musicControls.updateStatus(null);
		}
	};

	const destroy = () => {
		if (ambienceState.statusUnsubscribe) ambienceState.statusUnsubscribe();
		if (musicState.statusUnsubscribe) musicState.statusUnsubscribe();
		ambienceControls.destroy();
		musicControls.destroy();
		root.remove();
	};

	return {
		root,
		setPlaylists,
		setContext,
		setAmbiencePlayer,
		setMusicPlayer,
		destroy,
	};
}

type PlayerPanelControls = {
	updateStatus(status: PlaybackStatus | null): void;
	updatePlaylistDropdown(playlists: PlaylistData[]): void;
	destroy(): void;
};

function createPlayerPanel(
	host: HTMLElement,
	label: string,
	type: "ambience" | "music",
	state: PlayerPanelState,
	callbacks: AudioPanelCallbacks,
): PlayerPanelControls {
	const section = host.createDiv({ cls: "sm-audio-player" });

	// Header with label
	const sectionHeader = section.createDiv({ cls: "sm-audio-player__header" });
	sectionHeader.createEl("h4", { text: label, cls: "sm-audio-player__label" });

	// Playlist dropdown
	const playlistRow = section.createDiv({ cls: "sm-audio-player__row" });
	playlistRow.createSpan({ text: "Playlist:", cls: "sm-audio-player__label-small" });
	const playlistSelect = playlistRow.createEl("select", {
		cls: "sm-audio-player__dropdown",
	}) as HTMLSelectElement;
	playlistSelect.createEl("option", { value: "", text: "— Select playlist —" });
	playlistSelect.addEventListener("change", () => {
		const selectedId = playlistSelect.value;
		if (selectedId) {
			callbacks.onPlaylistSelect(selectedId, type);
		}
	});

	// Current track display
	const trackInfo = section.createDiv({ cls: "sm-audio-player__track-info" });
	const trackName = trackInfo.createDiv({ cls: "sm-audio-player__track-name", text: "—" });
	const trackProgress = trackInfo.createDiv({ cls: "sm-audio-player__track-progress" });
	const progressBar = trackProgress.createDiv({ cls: "sm-audio-player__progress-bar" });
	const progressFill = progressBar.createDiv({ cls: "sm-audio-player__progress-fill" });
	const progressTime = trackProgress.createDiv({
		cls: "sm-audio-player__progress-time",
		text: "0:00 / 0:00",
	});

	// Playback controls
	const controls = section.createDiv({ cls: "sm-audio-player__controls" });

	const playBtn = controls.createEl("button", {
		cls: "sm-audio-player__button sm-audio-player__button--play",
		attr: { title: "Play" },
	});
	setIcon(playBtn, "play");
	applyMapButtonStyle(playBtn);
	playBtn.addEventListener("click", (ev) => {
		ev.preventDefault();
		if (state.player && !playBtn.disabled) {
			void state.player.play();
		}
	});

	const pauseBtn = controls.createEl("button", {
		cls: "sm-audio-player__button sm-audio-player__button--pause",
		attr: { title: "Pause" },
	});
	setIcon(pauseBtn, "pause");
	applyMapButtonStyle(pauseBtn);
	pauseBtn.addEventListener("click", (ev) => {
		ev.preventDefault();
		if (state.player && !pauseBtn.disabled) {
			state.player.pause();
		}
	});

	const prevBtn = controls.createEl("button", {
		cls: "sm-audio-player__button sm-audio-player__button--prev",
		attr: { title: "Previous" },
	});
	setIcon(prevBtn, "skip-back");
	applyMapButtonStyle(prevBtn);
	prevBtn.addEventListener("click", (ev) => {
		ev.preventDefault();
		if (state.player && !prevBtn.disabled) {
			void state.player.skipPrevious();
		}
	});

	const nextBtn = controls.createEl("button", {
		cls: "sm-audio-player__button sm-audio-player__button--next",
		attr: { title: "Next" },
	});
	setIcon(nextBtn, "skip-forward");
	applyMapButtonStyle(nextBtn);
	nextBtn.addEventListener("click", (ev) => {
		ev.preventDefault();
		if (state.player && !nextBtn.disabled) {
			void state.player.skipNext();
		}
	});

	const stopBtn = controls.createEl("button", {
		cls: "sm-audio-player__button sm-audio-player__button--stop",
		attr: { title: "Stop" },
	});
	setIcon(stopBtn, "square");
	applyMapButtonStyle(stopBtn);
	stopBtn.addEventListener("click", (ev) => {
		ev.preventDefault();
		if (state.player && !stopBtn.disabled) {
			state.player.stop();
		}
	});

	// Volume control
	const volumeRow = section.createDiv({ cls: "sm-audio-player__row" });
	volumeRow.createSpan({ text: "Volume:", cls: "sm-audio-player__label-small" });
	const volumeInput = volumeRow.createEl("input", {
		type: "range",
		cls: "sm-audio-player__volume-slider",
		attr: { min: "0", max: "100", step: "1" },
	}) as HTMLInputElement;
	volumeInput.value = "70";
	const volumeLabel = volumeRow.createSpan({
		text: "70%",
		cls: "sm-audio-player__volume-label",
	});

	volumeInput.addEventListener("input", () => {
		const volume = parseInt(volumeInput.value, 10) / 100;
		volumeLabel.setText(`${volumeInput.value}%`);
		if (state.player) {
			state.player.setGlobalVolume(volume);
		}
		callbacks.onVolumeChange(volume, type);
	});

	// Toggle buttons (shuffle, loop)
	const toggleRow = section.createDiv({ cls: "sm-audio-player__row" });
	const shuffleBtn = toggleRow.createEl("button", {
		cls: "sm-audio-player__toggle",
		text: "Shuffle",
	});
	applyMapButtonStyle(shuffleBtn);
	shuffleBtn.addEventListener("click", (ev) => {
		ev.preventDefault();
		if (state.player) {
			state.player.toggleShuffle();
		}
	});

	const loopBtn = toggleRow.createEl("button", {
		cls: "sm-audio-player__toggle",
		text: "Loop",
	});
	applyMapButtonStyle(loopBtn);
	loopBtn.addEventListener("click", (ev) => {
		ev.preventDefault();
		if (state.player) {
			state.player.toggleLoop();
		}
	});

	const updateStatus = (status: PlaybackStatus | null) => {
		if (!status || !status.currentTrack) {
			// No track loaded
			trackName.setText("—");
			progressTime.setText("0:00 / 0:00");
			progressFill.style.width = "0%";
			playBtn.disabled = true;
			pauseBtn.disabled = true;
			prevBtn.disabled = true;
			nextBtn.disabled = true;
			stopBtn.disabled = true;
			shuffleBtn.classList.remove("is-active");
			loopBtn.classList.remove("is-active");
			return;
		}

		// Update track name
		trackName.setText(status.currentTrack.name || "Unknown Track");

		// Update progress
		const position = status.position || 0;
		const duration = status.currentTrack.duration || 0;
		const percent = duration > 0 ? (position / duration) * 100 : 0;
		progressFill.style.width = `${percent}%`;

		const formatTime = (seconds: number): string => {
			const mins = Math.floor(seconds / 60);
			const secs = Math.floor(seconds % 60);
			return `${mins}:${secs.toString().padStart(2, "0")}`;
		};
		progressTime.setText(`${formatTime(position)} / ${formatTime(duration)}`);

		// Update button states
		const isPlaying = status.state === "playing";
		const isStopped = status.state === "stopped" || status.state === "idle";
		const hasTrack = Boolean(status.currentTrack);

		playBtn.disabled = isPlaying || !hasTrack;
		pauseBtn.disabled = !isPlaying;
		prevBtn.disabled = isStopped || !hasTrack;
		nextBtn.disabled = isStopped || !hasTrack;
		stopBtn.disabled = isStopped;

		// Update toggle button states
		shuffleBtn.classList.toggle("is-active", status.shuffle);
		loopBtn.classList.toggle("is-active", status.loop);

		// Update volume display
		const vol = Math.round((status.globalVolume ?? 0.7) * 100);
		volumeInput.value = String(vol);
		volumeLabel.setText(`${vol}%`);
	};

	const updatePlaylistDropdown = (playlists: PlaylistData[]) => {
		// Clear existing options except first
		while (playlistSelect.options.length > 1) {
			playlistSelect.remove(1);
		}

		// Add playlists
		playlists.forEach((playlist) => {
			const option = playlistSelect.createEl("option", {
				value: playlist.name,
				text: playlist.display_name || playlist.name,
			});
		});
	};

	const destroy = () => {
		section.remove();
	};

	// Initialize
	updateStatus(null);

	return {
		updateStatus,
		updatePlaylistDropdown,
		destroy,
	};
}
