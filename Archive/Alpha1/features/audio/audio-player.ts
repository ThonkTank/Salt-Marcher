/**
 * Audio Player Service
 *
 * Core audio playback engine with crossfade transitions and volume control.
 * Manages track playback, shuffle, loop, and automatic progression.
 */

import { configurableLogger } from '@services/logging/configurable-logger';
import type { AudioPlayer, PlaybackState, PlaybackStatus, CurrentTrack } from "./audio-types";
import type { PlaylistData, AudioTrack } from "@services/domain";

const logger = configurableLogger.forModule("audio-player");

/**
 * Create an audio player instance
 *
 * @returns AudioPlayer instance with lifecycle management
 */
export function createAudioPlayer(): AudioPlayer {
	let playlist: PlaylistData | null = null;
	let currentTrackIndex = -1;
	let playbackState: PlaybackState = "idle";
	let globalVolume = 0.7;
	let shuffle = false;
	let loop = false;
	let crossfadeDuration = 2;

	// Audio elements for crossfading
	let primaryAudio: HTMLAudioElement | null = null;
	let secondaryAudio: HTMLAudioElement | null = null;
	let currentAudio: HTMLAudioElement | null = null;

	// Shuffle order
	let shuffleOrder: number[] = [];

	// Status change subscribers
	const statusSubscribers: Array<(status: PlaybackStatus) => void> = [];

	// Crossfade state
	let crossfadeStartTime: number | null = null;
	let crossfadeInterval: number | null = null;

	/**
	 * Initialize audio elements
	 */
	function initializeAudioElements(): void {
		if (!primaryAudio) {
			primaryAudio = new Audio();
			primaryAudio.addEventListener("ended", handleTrackEnded);
			primaryAudio.addEventListener("timeupdate", handleTimeUpdate);
			primaryAudio.addEventListener("loadedmetadata", handleMetadataLoaded);
			primaryAudio.addEventListener("error", handleAudioError);
		}
		if (!secondaryAudio) {
			secondaryAudio = new Audio();
			secondaryAudio.addEventListener("ended", handleTrackEnded);
			secondaryAudio.addEventListener("timeupdate", handleTimeUpdate);
			secondaryAudio.addEventListener("loadedmetadata", handleMetadataLoaded);
			secondaryAudio.addEventListener("error", handleAudioError);
		}
		currentAudio = primaryAudio;
	}

	/**
	 * Handle track ended event
	 */
	function handleTrackEnded(): void {
		if (playbackState === "crossfading") return;

		// Auto-advance to next track
		advanceToNextTrack().catch((error) => {
			logger.error("Failed to advance to next track", { error });
		});
	}

	/**
	 * Handle time update for position tracking
	 */
	function handleTimeUpdate(): void {
		if (!currentAudio || playbackState === "idle" || playbackState === "stopped") return;
		notifyStatusChange();
	}

	/**
	 * Handle metadata loaded
	 */
	function handleMetadataLoaded(): void {
		notifyStatusChange();
	}

	/**
	 * Handle audio error
	 */
	function handleAudioError(event: Event): void {
		const audio = event.target as HTMLAudioElement;
		const errorCode = audio.error?.code;
		const errorMessage = audio.error?.message || "Unknown error";

		// Provide user-friendly error messages
		let errorType = "Unknown error";
		if (errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
			errorType = "Format error";
		} else if (errorCode === MediaError.MEDIA_ERR_NETWORK) {
			errorType = "Network error";
		} else if (errorCode === MediaError.MEDIA_ERR_DECODE) {
			errorType = "Decode error";
		} else if (errorCode === MediaError.MEDIA_ERR_ABORTED) {
			errorType = "Playback aborted";
		}

		logger.error("Audio error", {
			src: audio.src,
			error: `MEDIA_ELEMENT_ERROR: ${errorType}`,
		});

		// Try next track automatically (graceful degradation)
		advanceToNextTrack().catch((error) => {
			logger.error("Failed to recover from audio error", { error });
		});
	}

	/**
	 * Advance to next track (respects shuffle/loop)
	 */
	async function advanceToNextTrack(): Promise<void> {
		if (!playlist) return;

		const nextIndex = getNextTrackIndex();
		if (nextIndex === -1) {
			// End of playlist, no loop
			stopPlayback();
			return;
		}

		await skipToTrackInternal(nextIndex);
	}

	/**
	 * Get next track index based on shuffle/loop settings
	 */
	function getNextTrackIndex(): number {
		if (!playlist) return -1;

		if (shuffle) {
			const currentOrderIndex = shuffleOrder.indexOf(currentTrackIndex);
			const nextOrderIndex = currentOrderIndex + 1;

			if (nextOrderIndex >= shuffleOrder.length) {
				if (loop) {
					// Reshuffle and start over
					generateShuffleOrder();
					return shuffleOrder[0];
				}
				return -1;
			}

			return shuffleOrder[nextOrderIndex];
		} else {
			const nextIndex = currentTrackIndex + 1;

			if (nextIndex >= playlist.tracks.length) {
				if (loop) {
					return 0;
				}
				return -1;
			}

			return nextIndex;
		}
	}

	/**
	 * Get previous track index
	 */
	function getPreviousTrackIndex(): number {
		if (!playlist) return -1;

		if (shuffle) {
			const currentOrderIndex = shuffleOrder.indexOf(currentTrackIndex);
			const prevOrderIndex = currentOrderIndex - 1;

			if (prevOrderIndex < 0) {
				if (loop) {
					return shuffleOrder[shuffleOrder.length - 1];
				}
				return -1;
			}

			return shuffleOrder[prevOrderIndex];
		} else {
			const prevIndex = currentTrackIndex - 1;

			if (prevIndex < 0) {
				if (loop) {
					return playlist.tracks.length - 1;
				}
				return -1;
			}

			return prevIndex;
		}
	}

	/**
	 * Generate shuffle order
	 */
	function generateShuffleOrder(): void {
		if (!playlist) return;

		shuffleOrder = Array.from({ length: playlist.tracks.length }, (_, i) => i);

		// Fisher-Yates shuffle
		for (let i = shuffleOrder.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffleOrder[i], shuffleOrder[j]] = [shuffleOrder[j], shuffleOrder[i]];
		}
	}

	/**
	 * Load track into audio element
	 */
	function loadTrack(audio: HTMLAudioElement, track: AudioTrack): void {
		audio.src = track.source;
		audio.load();

		// Set track-specific volume
		const trackVolume = track.volume ?? playlist?.default_volume ?? 0.7;
		audio.volume = Math.max(0, Math.min(1, trackVolume * globalVolume));
	}

	/**
	 * Start crossfade from current to next track
	 */
	async function startCrossfade(nextTrackIndex: number): Promise<void> {
		if (!playlist || !currentAudio) return;

		const nextTrack = playlist.tracks[nextTrackIndex];
		if (!nextTrack) return;

		// Use secondary audio element for next track
		const nextAudio = currentAudio === primaryAudio ? secondaryAudio! : primaryAudio!;

		loadTrack(nextAudio, nextTrack);

		// Wait for metadata to load
		await new Promise<void>((resolve) => {
			const handler = () => {
				nextAudio.removeEventListener("loadedmetadata", handler);
				resolve();
			};
			nextAudio.addEventListener("loadedmetadata", handler);
		});

		// Start playback of next track at 0 volume
		nextAudio.volume = 0;
		await nextAudio.play();

		// Begin crossfade
		playbackState = "crossfading";
		crossfadeStartTime = Date.now();

		const fadeSteps = Math.ceil(crossfadeDuration * 60); // 60fps
		const fadeInterval = (crossfadeDuration * 1000) / fadeSteps;

		crossfadeInterval = window.setInterval(() => {
			if (!crossfadeStartTime) return;

			const elapsed = (Date.now() - crossfadeStartTime) / 1000;
			const progress = Math.min(1, elapsed / crossfadeDuration);

			// Linear crossfade
			const oldVolume = (1 - progress) * (currentAudio?.volume ?? 0);
			const newVolume = progress * (nextTrack.volume ?? playlist?.default_volume ?? 0.7) * globalVolume;

			if (currentAudio) currentAudio.volume = Math.max(0, Math.min(1, oldVolume));
			nextAudio.volume = Math.max(0, Math.min(1, newVolume));

			if (progress >= 1) {
				// Crossfade complete
				completeCrossfade(nextAudio, nextTrackIndex);
			}
		}, fadeInterval);

		notifyStatusChange();
	}

	/**
	 * Complete crossfade and switch to new track
	 */
	function completeCrossfade(nextAudio: HTMLAudioElement, nextTrackIndex: number): void {
		if (crossfadeInterval !== null) {
			window.clearInterval(crossfadeInterval);
			crossfadeInterval = null;
		}

		// Pause and reset old audio
		if (currentAudio) {
			currentAudio.pause();
			currentAudio.currentTime = 0;
		}

		// Switch to new audio
		currentAudio = nextAudio;
		currentTrackIndex = nextTrackIndex;
		playbackState = "playing";
		crossfadeStartTime = null;

		notifyStatusChange();
	}

	/**
	 * Get current track info
	 */
	function getCurrentTrack(): CurrentTrack | null {
		if (!playlist || currentTrackIndex < 0 || !currentAudio) return null;

		const track = playlist.tracks[currentTrackIndex];
		if (!track) return null;

		const trackVolume = track.volume ?? playlist.default_volume ?? 0.7;

		return {
			track,
			index: currentTrackIndex,
			position: currentAudio.currentTime,
			duration: track.duration ?? currentAudio.duration,
			effectiveVolume: trackVolume * globalVolume,
		};
	}

	/**
	 * Get current status
	 */
	function getStatus(): PlaybackStatus {
		return {
			state: playbackState,
			currentTrack: getCurrentTrack(),
			playlist,
			globalVolume,
			shuffle,
			loop,
			crossfadeDuration,
		};
	}

	/**
	 * Notify all subscribers of status change
	 */
	function notifyStatusChange(): void {
		const status = getStatus();
		statusSubscribers.forEach((callback) => {
			try {
				callback(status);
			} catch (error) {
				logger.error("Status callback error", { error });
			}
		});
	}

	/**
	 * Internal stop implementation
	 */
	function stopPlayback(): void {
		// Cancel any ongoing crossfade
		if (crossfadeInterval !== null) {
			window.clearInterval(crossfadeInterval);
			crossfadeInterval = null;
		}

		// Stop all audio
		if (primaryAudio) {
			primaryAudio.pause();
			primaryAudio.currentTime = 0;
			primaryAudio.src = "";
		}
		if (secondaryAudio) {
			secondaryAudio.pause();
			secondaryAudio.currentTime = 0;
			secondaryAudio.src = "";
		}

		currentAudio = primaryAudio;
		currentTrackIndex = -1;

		// Only set to stopped if we have a playlist, otherwise stay idle
		if (playlist && playlist.tracks.length > 0) {
			playbackState = "stopped";
		} else {
			playbackState = "idle";
		}

		crossfadeStartTime = null;

		notifyStatusChange();
	}

	/**
	 * Internal skip to track implementation
	 */
	async function skipToTrackInternal(index: number): Promise<void> {
		if (!playlist || index < 0 || index >= playlist.tracks.length) {
			logger.error("Invalid track index", { index });
			return;
		}

		const wasPlaying = playbackState === "playing" || playbackState === "crossfading";

		// Cancel any ongoing crossfade
		if (crossfadeInterval !== null) {
			window.clearInterval(crossfadeInterval);
			crossfadeInterval = null;
		}

		// Stop current audio
		if (currentAudio) {
			currentAudio.pause();
			currentAudio.currentTime = 0;
		}

		currentTrackIndex = index;
		playbackState = wasPlaying ? "playing" : "stopped";

		if (wasPlaying) {
			initializeAudioElements();
			const track = playlist.tracks[index];
			loadTrack(currentAudio!, track);
			await currentAudio!.play();
		}

		notifyStatusChange();
	}

	// Public API implementation
	const api: AudioPlayer = {
		loadPlaylist(newPlaylist: PlaylistData): void {
			logger.info("Loading playlist", { name: newPlaylist.name });

			// Stop current playback
			stopPlayback();

			playlist = newPlaylist;
			shuffle = newPlaylist.shuffle ?? false;
			loop = newPlaylist.loop ?? false;
			crossfadeDuration = newPlaylist.crossfade_duration ?? 2;

			if (shuffle) {
				generateShuffleOrder();
			}

			notifyStatusChange();
		},

		async play(): Promise<void> {
			if (!playlist || playlist.tracks.length === 0) {
				logger.warn("Cannot play: no playlist loaded");
				return;
			}

			initializeAudioElements();

			if (playbackState === "paused" && currentAudio) {
				// Resume from pause
				await currentAudio.play();
				playbackState = "playing";
				notifyStatusChange();
				return;
			}

			// Start from beginning or first track
			if (currentTrackIndex < 0) {
				currentTrackIndex = shuffle ? shuffleOrder[0] : 0;
			}

			const track = playlist.tracks[currentTrackIndex];
			if (!track) {
				logger.error("Invalid track index", { currentTrackIndex });
				return;
			}

			loadTrack(currentAudio!, track);
			await currentAudio!.play();
			playbackState = "playing";

			notifyStatusChange();
		},

		pause(): void {
			if (playbackState === "playing" && currentAudio) {
				currentAudio.pause();
				playbackState = "paused";
				notifyStatusChange();
			}
		},

		stop(): void {
			stopPlayback();
		},

		async skipNext(): Promise<void> {
			if (!playlist) return;

			const nextIndex = getNextTrackIndex();
			if (nextIndex === -1) {
				stopPlayback();
				return;
			}

			// Use crossfade if enabled and currently playing
			if (playbackState === "playing" && crossfadeDuration > 0) {
				await startCrossfade(nextIndex);
			} else {
				await skipToTrackInternal(nextIndex);
			}
		},

		async skipPrevious(): Promise<void> {
			if (!playlist) return;

			// If more than 3 seconds into track, restart current track
			if (currentAudio && currentAudio.currentTime > 3) {
				currentAudio.currentTime = 0;
				notifyStatusChange();
				return;
			}

			const prevIndex = getPreviousTrackIndex();
			if (prevIndex === -1) {
				// Restart current track
				if (currentAudio) {
					currentAudio.currentTime = 0;
					notifyStatusChange();
				}
				return;
			}

			await skipToTrackInternal(prevIndex);
		},

		async skipToTrack(index: number): Promise<void> {
			await skipToTrackInternal(index);
		},

		setGlobalVolume(volume: number): void {
			globalVolume = Math.max(0, Math.min(1, volume));

			// Update current audio volume
			if (currentAudio && playlist && currentTrackIndex >= 0) {
				const track = playlist.tracks[currentTrackIndex];
				const trackVolume = track?.volume ?? playlist.default_volume ?? 0.7;
				currentAudio.volume = Math.max(0, Math.min(1, trackVolume * globalVolume));
			}

			notifyStatusChange();
		},

		toggleShuffle(): void {
			shuffle = !shuffle;

			if (shuffle) {
				generateShuffleOrder();
			}

			logger.info("Shuffle toggled", { shuffle });
			notifyStatusChange();
		},

		toggleLoop(): void {
			loop = !loop;
			logger.info("Loop toggled", { loop });
			notifyStatusChange();
		},

		setCrossfadeDuration(seconds: number): void {
			crossfadeDuration = Math.max(0, Math.min(10, seconds));
			logger.info("Crossfade duration set", { crossfadeDuration });
			notifyStatusChange();
		},

		seek(position: number): void {
			if (currentAudio) {
				currentAudio.currentTime = Math.max(0, Math.min(currentAudio.duration, position));
				notifyStatusChange();
			}
		},

		getStatus,

		onStatusChange(callback: (status: PlaybackStatus) => void): () => void {
			statusSubscribers.push(callback);

			// Return unsubscribe function
			return () => {
				const index = statusSubscribers.indexOf(callback);
				if (index >= 0) {
					statusSubscribers.splice(index, 1);
				}
			};
		},

		dispose(): void {
			logger.info("Disposing");

			// Stop playback
			stopPlayback();

			// Clean up audio elements
			if (primaryAudio) {
				primaryAudio.removeEventListener("ended", handleTrackEnded);
				primaryAudio.removeEventListener("timeupdate", handleTimeUpdate);
				primaryAudio.removeEventListener("loadedmetadata", handleMetadataLoaded);
				primaryAudio.removeEventListener("error", handleAudioError);
				primaryAudio.src = "";
				primaryAudio = null;
			}
			if (secondaryAudio) {
				secondaryAudio.removeEventListener("ended", handleTrackEnded);
				secondaryAudio.removeEventListener("timeupdate", handleTimeUpdate);
				secondaryAudio.removeEventListener("loadedmetadata", handleMetadataLoaded);
				secondaryAudio.removeEventListener("error", handleAudioError);
				secondaryAudio.src = "";
				secondaryAudio = null;
			}

			currentAudio = null;
			playlist = null;
			statusSubscribers.length = 0;
		},
	};

	return api;
}
