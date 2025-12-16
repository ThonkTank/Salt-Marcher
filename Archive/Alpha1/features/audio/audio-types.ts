/**
 * Audio Player Core Types
 *
 * Defines types for audio playback engine with crossfade and volume control.
 */

import type { PlaylistData, AudioTrack } from "@services/domain";

/**
 * Playback state of the audio player
 */
export type PlaybackState = "idle" | "playing" | "paused" | "stopped" | "crossfading";

/**
 * Current track being played with its metadata
 */
export interface CurrentTrack {
	/** Track from playlist */
	track: AudioTrack;
	/** Index in tracks array */
	index: number;
	/** Current playback position in seconds */
	position: number;
	/** Track duration in seconds (from metadata or playlist) */
	duration: number;
	/** Effective volume (track volume * global volume) */
	effectiveVolume: number;
}

/**
 * Playback status information
 */
export interface PlaybackStatus {
	/** Current playback state */
	state: PlaybackState;
	/** Currently playing track (null if idle/stopped) */
	currentTrack: CurrentTrack | null;
	/** Active playlist (null if none loaded) */
	playlist: PlaylistData | null;
	/** Global volume (0.0 - 1.0) */
	globalVolume: number;
	/** Whether shuffle is enabled */
	shuffle: boolean;
	/** Whether loop is enabled */
	loop: boolean;
	/** Crossfade duration in seconds */
	crossfadeDuration: number;
}

/**
 * Audio player control interface
 */
export interface AudioPlayer {
	/** Load a playlist for playback */
	loadPlaylist(playlist: PlaylistData): void;

	/** Start or resume playback */
	play(): Promise<void>;

	/** Pause playback */
	pause(): void;

	/** Stop playback and reset to beginning */
	stop(): void;

	/** Skip to next track */
	skipNext(): Promise<void>;

	/** Skip to previous track */
	skipPrevious(): Promise<void>;

	/** Skip to specific track index */
	skipToTrack(index: number): Promise<void>;

	/** Set global volume (0.0 - 1.0) */
	setGlobalVolume(volume: number): void;

	/** Toggle shuffle mode */
	toggleShuffle(): void;

	/** Toggle loop mode */
	toggleLoop(): void;

	/** Set crossfade duration in seconds */
	setCrossfadeDuration(seconds: number): void;

	/** Seek to position in current track (seconds) */
	seek(position: number): void;

	/** Get current playback status */
	getStatus(): PlaybackStatus;

	/** Subscribe to status changes */
	onStatusChange(callback: (status: PlaybackStatus) => void): () => void;

	/** Cleanup and release resources */
	dispose(): void;
}
