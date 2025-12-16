/**
 * Audio Panel Component for Session Runner
 *
 * Provides compact, practical audio controls with card-based UI.
 *
 * Features:
 * - Dual players (ambience + music) in collapsible cards
 * - Minimized view: Track info, progress, play/pause/skip, context tags
 * - Expanded view: Playlist dropdown, shuffle/loop, volume, stop
 * - Seekable progress bar (click to jump)
 * - Auto-selection indicator and playback status animation
 * - Consistent with Session Runner card style (party, weather, travel)
 */

import { setIcon } from "obsidian";
import type { SessionContext } from "@features/audio/auto-selection-types";
import type { AudioPlayer, PlaybackStatus } from "@features/audio/audio-types";
import type { PlaylistData } from "../../library/playlists/playlist-types";

export type AudioPanelCallbacks = {
	onPlaylistSelect: (playlistId: string, type: "ambience" | "music") => void;
	onVolumeChange: (volume: number, type: "ambience" | "music") => void;
	onSkipForward: (type: "ambience" | "music") => void;
	onSkipBack: (type: "ambience" | "music") => void;
	onToggleAuto: (type: "ambience" | "music") => void;
};

export type AudioPanelHandle = {
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
	isAutoSelected: boolean;
};

/**
 * Create audio panel component
 * Creates content directly in the provided host element (no wrapper div or header)
 */
export function createAudioPanel(host: HTMLElement, callbacks: AudioPanelCallbacks): AudioPanelHandle {
	// Context display (shared between both players)
	const contextDisplay = host.createDiv({ cls: "sm-audio-context-display" });
	const contextTags = contextDisplay.createDiv({ cls: "sm-audio-context" });

	// Ambience player card
	const ambienceState: PlayerPanelState = {
		player: null,
		statusUnsubscribe: null,
		currentPlaylist: null,
		isAutoSelected: false,
	};
	const ambienceControls = createCompactPlayerCard(
		host,
		"Ambience",
		"ambience",
		ambienceState,
		callbacks,
	);

	// Music player card
	const musicState: PlayerPanelState = {
		player: null,
		statusUnsubscribe: null,
		currentPlaylist: null,
		isAutoSelected: false,
	};
	const musicControls = createCompactPlayerCard(host, "Music", "music", musicState, callbacks);

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
			contextTags.createSpan({ text: "No context", cls: "sm-audio-context__tag sm-audio-context__tag--empty" });
			return;
		}

		contextTags.empty();

		// Helper to add tag
		const addTag = (value: string, category: string) => {
			const tag = contextTags.createSpan({
				cls: `sm-audio-context__tag`,
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
			contextTags.createSpan({ text: "No tags", cls: "sm-audio-context__tag sm-audio-context__tag--empty" });
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
		host.empty();
	};

	return {
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
	setAutoSelected(isAuto: boolean): void;
	destroy(): void;
};

/**
 * Create compact player card with minimized/expanded views
 * Uses sm-panel-card structure consistent with Party/Weather/Travel cards
 */
function createCompactPlayerCard(
	host: HTMLElement,
	label: string,
	type: "ambience" | "music",
	state: PlayerPanelState,
	callbacks: AudioPanelCallbacks,
): PlayerPanelControls {
	// Card container (initially collapsed)
	const card = host.createDiv({ cls: "sm-panel-card sm-panel-card--compact is-collapsed" });

	// === HEADER (always visible) ===
	const header = card.createDiv({ cls: "sm-panel-card__header" });
	const headerLeft = header.createDiv({ cls: "sm-panel-card__header-left" });

	// Collapse icon
	const collapseIcon = headerLeft.createDiv({ cls: "sm-panel-card__icon", text: "▸" });

	// Title
	headerLeft.createDiv({ cls: "sm-panel-card__title", text: label });

	// Auto-select toggle
	const autoToggle = header.createEl("button", {
		cls: "sm-audio-expanded__toggle sm-panel-card__header-toggle",
		text: "Auto",
		attr: { title: "Toggle auto-select" },
	});
	autoToggle.addEventListener("click", (e) => {
		e.stopPropagation();
		state.isAutoSelected = !state.isAutoSelected;
		updateAutoIndicator();
		callbacks.onToggleAuto(type);
	});

	// Playback status indicator (⏵)
	const playbackStatus = header.createSpan({
		cls: "sm-audio-status",
		text: "⏵",
		attr: { title: "Playing" },
	});
	playbackStatus.style.display = "none";

	// Toggle expand/collapse
	header.addEventListener("click", (e) => {
		// Don't toggle if clicking auto toggle button
		if (e.target === autoToggle) return;

		if (card.hasClass("is-expanded")) {
			card.removeClass("is-expanded");
			card.addClass("is-collapsed");
		} else {
			card.removeClass("is-collapsed");
			card.addClass("is-expanded");
		}
	});

	// === MINIMIZED VIEW (always visible when expanded) ===
	const body = card.createDiv({ cls: "sm-panel-card__body" });

	// Track info (song name + time in one line, playlist below)
	const trackInfo = body.createDiv({ cls: "sm-audio-track" });
	const trackHeader = trackInfo.createDiv({ cls: "sm-audio-track__header" });
	const trackName = trackHeader.createDiv({ cls: "sm-audio-track__name", text: "—" });
	const timeDisplay = trackHeader.createDiv({ cls: "sm-audio-track__time", text: "0:00 / 0:00" });
	const trackPlaylist = trackInfo.createDiv({ cls: "sm-audio-track__playlist", text: "" });

	// Progress bar (seekable)
	const progressContainer = body.createDiv({ cls: "sm-audio-progress-container" });
	const progressBar = progressContainer.createDiv({ cls: "sm-audio-progress" });
	const progressFill = progressBar.createDiv({ cls: "sm-audio-progress__fill" });

	// Progress bar click to seek
	progressBar.addEventListener("click", (e) => {
		if (!state.player) return;
		const status = state.player.getStatus();
		if (!status || !status.currentTrack || !status.currentTrack.duration) return;

		const rect = progressBar.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const percent = clickX / rect.width;
		const newPosition = Math.max(0, Math.min(status.currentTrack.duration, percent * status.currentTrack.duration));

		void state.player.seek(newPosition);
	});

	// Playback controls (icon-only: Skip Back, Previous, Play/Pause, Next, Skip Forward)
	const controls = body.createDiv({ cls: "sm-audio-controls" });

	const skipBackBtn = controls.createEl("button", {
		cls: "sm-audio-controls__button",
		attr: { title: "Skip Back 10s" },
	});
	setIcon(skipBackBtn, "rewind");
	skipBackBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		callbacks.onSkipBack(type);
	});

	const prevBtn = controls.createEl("button", {
		cls: "sm-audio-controls__button",
		attr: { title: "Previous Track" },
	});
	setIcon(prevBtn, "skip-back");
	prevBtn.addEventListener("click", (e) => {
		e.stopPropagation(); // Prevent card collapse
		if (state.player && !prevBtn.disabled) {
			void state.player.skipPrevious();
		}
	});

	const playPauseBtn = controls.createEl("button", {
		cls: "sm-audio-controls__button sm-audio-controls__button--primary",
		attr: { title: "Play" },
	});
	setIcon(playPauseBtn, "play");
	playPauseBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		if (!state.player) return;
		const status = state.player.getStatus();
		if (status && status.state === "playing") {
			state.player.pause();
		} else {
			void state.player.play();
		}
	});

	const nextBtn = controls.createEl("button", {
		cls: "sm-audio-controls__button",
		attr: { title: "Next Track" },
	});
	setIcon(nextBtn, "skip-forward");
	nextBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		if (state.player && !nextBtn.disabled) {
			void state.player.skipNext();
		}
	});

	const skipForwardBtn = controls.createEl("button", {
		cls: "sm-audio-controls__button",
		attr: { title: "Skip Forward 10s" },
	});
	setIcon(skipForwardBtn, "fast-forward");
	skipForwardBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		callbacks.onSkipForward(type);
	});

	// === EXPANDED VIEW (collapsible) ===
	const expandedSection = body.createDiv({ cls: "sm-audio-expanded" });

	// Playlist dropdown (full width)
	const playlistRow = expandedSection.createDiv({ cls: "sm-audio-expanded__row" });
	playlistRow.createSpan({ text: "Playlist:", cls: "sm-audio-expanded__label" });
	const playlistSelect = playlistRow.createEl("select", {
		cls: "sm-audio-expanded__dropdown",
	}) as HTMLSelectElement;
	playlistSelect.createEl("option", { value: "", text: "— Auto-select —" });
	playlistSelect.addEventListener("change", (e) => {
		e.stopPropagation();
		const selectedId = playlistSelect.value;
		if (selectedId) {
			state.isAutoSelected = false;
			callbacks.onPlaylistSelect(selectedId, type);
		} else {
			state.isAutoSelected = true;
		}
		updateAutoIndicator();
	});

	// Controls row (Shuffle, Loop, Volume, Stop - all in one line)
	const controlsRow = expandedSection.createDiv({ cls: "sm-audio-expanded__controls" });

	const shuffleBtn = controlsRow.createEl("button", {
		cls: "sm-audio-expanded__toggle",
		text: "🔀",
		attr: { title: "Shuffle" },
	});
	shuffleBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		if (state.player) {
			state.player.toggleShuffle();
		}
	});

	const loopBtn = controlsRow.createEl("button", {
		cls: "sm-audio-expanded__toggle",
		text: "🔁",
		attr: { title: "Loop" },
	});
	loopBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		if (state.player) {
			state.player.toggleLoop();
		}
	});

	// Volume control (icon + popup)
	const volumeWrapper = controlsRow.createDiv({ cls: "sm-audio-volume" });
	const volumeBtn = volumeWrapper.createEl("button", {
		cls: "sm-audio-expanded__toggle",
		text: "🔊",
		attr: { title: "Volume" },
	});

	// Volume popup
	const volumePopup = volumeWrapper.createDiv({ cls: "sm-audio-volume__popup" });
	const volumeSlider = volumePopup.createEl("input", {
		type: "range",
		cls: "sm-audio-volume__slider",
		attr: { min: "0", max: "100", step: "1" },
	}) as HTMLInputElement;
	volumeSlider.value = "70";
	const volumeLabel = volumePopup.createSpan({ text: "70%", cls: "sm-audio-volume__label" });

	volumeBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		volumePopup.classList.toggle("is-visible");
	});

	volumeSlider.addEventListener("input", (e) => {
		e.stopPropagation();
		const volume = parseInt(volumeSlider.value, 10) / 100;
		volumeLabel.setText(`${volumeSlider.value}%`);
		volumeBtn.setText(`🔊`);
		if (state.player) {
			state.player.setGlobalVolume(volume);
		}
		callbacks.onVolumeChange(volume, type);
	});

	// Close popup on outside click
	document.addEventListener("click", (e) => {
		if (!volumeWrapper.contains(e.target as Node)) {
			volumePopup.classList.remove("is-visible");
		}
	});

	// Stop button
	const stopBtn = controlsRow.createEl("button", {
		cls: "sm-audio-expanded__toggle sm-audio-expanded__button--stop",
		text: "⏹",
		attr: { title: "Stop" },
	});
	stopBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		if (state.player && !stopBtn.disabled) {
			state.player.stop();
		}
	});

	// === STATUS UPDATE LOGIC ===
	const updateStatus = (status: PlaybackStatus | null) => {
		if (!status || !status.currentTrack) {
			// No track loaded
			trackName.setText("—");
			trackPlaylist.setText("");
			timeDisplay.setText("0:00 / 0:00");
			progressFill.style.width = "0%";
			playPauseBtn.disabled = true;
			prevBtn.disabled = true;
			nextBtn.disabled = true;
			stopBtn.disabled = true;
			playbackStatus.style.display = "none";
			playbackStatus.classList.remove("sm-audio-status--playing");
			return;
		}

		// Update track name and playlist
		trackName.setText(status.currentTrack.track.name || "Unknown Track");
		if (state.currentPlaylist) {
			trackPlaylist.setText(state.currentPlaylist.display_name || state.currentPlaylist.name);
		}

		// Update progress
		const position = status.currentTrack.position || 0;
		const duration = status.currentTrack.duration || 0;
		const percent = duration > 0 ? (position / duration) * 100 : 0;
		progressFill.style.width = `${percent}%`;

		const formatTime = (seconds: number): string => {
			const mins = Math.floor(seconds / 60);
			const secs = Math.floor(seconds % 60);
			return `${mins}:${secs.toString().padStart(2, "0")}`;
		};
		timeDisplay.setText(`${formatTime(position)} / ${formatTime(duration)}`);

		// Update play/pause button
		const isPlaying = status.state === "playing";
		const isStopped = status.state === "stopped" || status.state === "idle";
		const hasTrack = Boolean(status.currentTrack);

		if (isPlaying) {
			setIcon(playPauseBtn, "pause");
			playPauseBtn.setAttribute("title", "Pause");
		} else {
			setIcon(playPauseBtn, "play");
			playPauseBtn.setAttribute("title", "Play");
		}

		playPauseBtn.disabled = !hasTrack;
		prevBtn.disabled = isStopped || !hasTrack;
		nextBtn.disabled = isStopped || !hasTrack;
		stopBtn.disabled = isStopped;

		// Update playback status indicator
		if (isPlaying) {
			playbackStatus.style.display = "inline";
			playbackStatus.classList.add("sm-audio-status--playing");
		} else {
			playbackStatus.style.display = "none";
			playbackStatus.classList.remove("sm-audio-status--playing");
		}

		// Update toggle button states
		shuffleBtn.classList.toggle("is-active", status.shuffle);
		loopBtn.classList.toggle("is-active", status.loop);

		// Update volume display
		const vol = Math.round((status.globalVolume ?? 0.7) * 100);
		volumeSlider.value = String(vol);
		volumeLabel.setText(`${vol}%`);
		volumeBtn.setText(`🔊`);
	};

	const updatePlaylistDropdown = (playlists: PlaylistData[]) => {
		// Clear existing options except first (Auto-select)
		while (playlistSelect.options.length > 1) {
			playlistSelect.remove(1);
		}

		// Add playlists
		playlists.forEach((playlist) => {
			playlistSelect.createEl("option", {
				value: playlist.name,
				text: playlist.display_name || playlist.name,
			});
		});
	};

	const updateAutoIndicator = () => {
		if (state.isAutoSelected) {
			autoToggle.classList.add("is-active");
		} else {
			autoToggle.classList.remove("is-active");
		}
	};

	const setAutoSelected = (isAuto: boolean) => {
		state.isAutoSelected = isAuto;
		updateAutoIndicator();
	};

	const destroy = () => {
		card.remove();
	};

	// Initialize
	updateStatus(null);
	updateAutoIndicator();

	return {
		updateStatus,
		updatePlaylistDropdown,
		setAutoSelected,
		destroy,
	};
}
