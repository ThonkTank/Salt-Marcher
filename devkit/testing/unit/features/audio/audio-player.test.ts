// devkit/testing/unit/features/audio/audio-player.test.ts
// Tests core audio playback functionality: play/pause/skip, volume control, shuffle, loop, crossfade logic.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createAudioPlayer } from "../../../../../src/features/audio/audio-player";
import type { AudioPlayer, PlaybackStatus } from "../../../../../src/features/audio/types";
import type { PlaylistData } from "../../../../../src/workmodes/library/playlists/types";

// Mock HTMLAudioElement
class MockAudioElement {
	src = "";
	volume = 1;
	currentTime = 0;
	duration = 180;
	paused = true;
	error: Error | null = null;

	private listeners: Record<string, Array<(event: any) => void>> = {};

	addEventListener(event: string, handler: (event: any) => void): void {
		if (!this.listeners[event]) {
			this.listeners[event] = [];
		}
		this.listeners[event].push(handler);
	}

	removeEventListener(event: string, handler: (event: any) => void): void {
		if (this.listeners[event]) {
			const index = this.listeners[event].indexOf(handler);
			if (index >= 0) {
				this.listeners[event].splice(index, 1);
			}
		}
	}

	emit(event: string, data?: any): void {
		if (this.listeners[event]) {
			this.listeners[event].forEach((handler) => handler(data ?? { target: this }));
		}
	}

	load(): void {
		// Simulate metadata loaded immediately
		Promise.resolve().then(() => this.emit("loadedmetadata"));
	}

	async play(): Promise<void> {
		this.paused = false;
		// Immediately resolve
		await Promise.resolve();
	}

	pause(): void {
		this.paused = true;
	}
}

// Setup global Audio mock
beforeEach(() => {
	// @ts-ignore
	global.Audio = MockAudioElement;
	vi.useFakeTimers();
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

// Test fixtures
const createTestPlaylist = (overrides?: Partial<PlaylistData>): PlaylistData => ({
	name: "test-playlist",
	type: "music",
	tracks: [
		{ name: "Track 1", source: "track1.mp3", duration: 180, volume: 0.8 },
		{ name: "Track 2", source: "track2.mp3", duration: 240, volume: 0.6 },
		{ name: "Track 3", source: "track3.mp3", duration: 200, volume: 0.9 },
	],
	shuffle: false,
	loop: false,
	crossfade_duration: 2,
	default_volume: 0.7,
	...overrides,
});

describe("AudioPlayer - Initialization", () => {
	it("creates player with idle state", () => {
		const player = createAudioPlayer();
		const status = player.getStatus();

		expect(status.state).toBe("idle");
		expect(status.currentTrack).toBeNull();
		expect(status.playlist).toBeNull();
		expect(status.globalVolume).toBe(0.7);
	});

	it("loads playlist successfully", () => {
		const player = createAudioPlayer();
		const playlist = createTestPlaylist();

		player.loadPlaylist(playlist);
		const status = player.getStatus();

		expect(status.playlist).toEqual(playlist);
		expect(status.shuffle).toBe(false);
		expect(status.loop).toBe(false);
		expect(status.crossfadeDuration).toBe(2);
	});

	it("applies playlist default settings", () => {
		const player = createAudioPlayer();
		const playlist = createTestPlaylist({
			shuffle: true,
			loop: true,
			crossfade_duration: 5,
		});

		player.loadPlaylist(playlist);
		const status = player.getStatus();

		expect(status.shuffle).toBe(true);
		expect(status.loop).toBe(true);
		expect(status.crossfadeDuration).toBe(5);
	});
});

describe("AudioPlayer - Playback Controls", () => {
	let player: AudioPlayer;

	beforeEach(() => {
		player = createAudioPlayer();
		const playlist = createTestPlaylist();
		player.loadPlaylist(playlist);
	});

	afterEach(() => {
		player.dispose();
	});

	it("starts playback from first track", async () => {
		await player.play();
		vi.runAllTimers();

		const status = player.getStatus();
		expect(status.state).toBe("playing");
		expect(status.currentTrack).not.toBeNull();
		expect(status.currentTrack?.index).toBe(0);
		expect(status.currentTrack?.track.name).toBe("Track 1");
	});

	it("pauses playback", async () => {
		await player.play();
		vi.runAllTimers();

		player.pause();
		const status = player.getStatus();

		expect(status.state).toBe("paused");
	});

	it("resumes from pause", async () => {
		await player.play();
		vi.runAllTimers();

		player.pause();
		await player.play();
		vi.runAllTimers();

		const status = player.getStatus();
		expect(status.state).toBe("playing");
	});

	it("stops playback and resets", async () => {
		await player.play();
		vi.runAllTimers();

		player.stop();
		const status = player.getStatus();

		expect(status.state).toBe("stopped");
		expect(status.currentTrack).toBeNull();
	});

	it("seeks to position", async () => {
		await player.play();
		vi.runAllTimers();

		player.seek(60);
		const status = player.getStatus();

		expect(status.currentTrack?.position).toBe(60);
	});
});

describe("AudioPlayer - Track Navigation", () => {
	let player: AudioPlayer;

	beforeEach(() => {
		player = createAudioPlayer();
		const playlist = createTestPlaylist();
		player.loadPlaylist(playlist);
	});

	afterEach(() => {
		player.dispose();
	});

	it("skips to next track", async () => {
		await player.play();
		vi.runAllTimers();

		await player.skipNext();
		vi.runAllTimers();

		const status = player.getStatus();
		expect(status.currentTrack?.index).toBe(1);
		expect(status.currentTrack?.track.name).toBe("Track 2");
	});

	it("skips to previous track", async () => {
		await player.play();
		vi.runAllTimers();

		await player.skipNext();
		vi.runAllTimers();

		await player.skipPrevious();
		vi.runAllTimers();

		const status = player.getStatus();
		expect(status.currentTrack?.index).toBe(0);
	});

	it("restarts current track if >3s elapsed", async () => {
		await player.play();
		vi.runAllTimers();

		// Simulate 4 seconds elapsed
		player.seek(4);

		await player.skipPrevious();
		vi.runAllTimers();

		const status = player.getStatus();
		expect(status.currentTrack?.index).toBe(0);
		expect(status.currentTrack?.position).toBe(0);
	});

	it("skips to specific track index", async () => {
		await player.play();
		vi.runAllTimers();

		await player.skipToTrack(2);
		vi.runAllTimers();

		const status = player.getStatus();
		expect(status.currentTrack?.index).toBe(2);
		expect(status.currentTrack?.track.name).toBe("Track 3");
	});

	it("stops at end of playlist when loop disabled", async () => {
		await player.play();
		vi.runAllTimers();

		// Skip to last track
		await player.skipToTrack(2);
		vi.runAllTimers();

		// Try to skip next
		await player.skipNext();
		vi.runAllTimers();

		const status = player.getStatus();
		expect(status.state).toBe("stopped");
	});
});

describe("AudioPlayer - Loop Mode", () => {
	let player: AudioPlayer;

	beforeEach(() => {
		player = createAudioPlayer();
		const playlist = createTestPlaylist({ loop: true });
		player.loadPlaylist(playlist);
	});

	afterEach(() => {
		player.dispose();
	});

	it("loops back to first track", async () => {
		await player.play();
		vi.runAllTimers();

		// Skip to last track
		await player.skipToTrack(2);
		vi.runAllTimers();

		// Skip next should loop to first
		await player.skipNext();
		vi.runAllTimers();

		const status = player.getStatus();
		expect(status.currentTrack?.index).toBe(0);
	});

	it("loops back to last track when skipping previous from first", async () => {
		await player.play();
		vi.runAllTimers();

		await player.skipPrevious();
		vi.runAllTimers();

		const status = player.getStatus();
		expect(status.currentTrack?.index).toBe(2);
	});

	it("toggles loop mode", () => {
		expect(player.getStatus().loop).toBe(true);

		player.toggleLoop();
		expect(player.getStatus().loop).toBe(false);

		player.toggleLoop();
		expect(player.getStatus().loop).toBe(true);
	});
});

describe("AudioPlayer - Shuffle Mode", () => {
	let player: AudioPlayer;

	beforeEach(() => {
		player = createAudioPlayer();
		const playlist = createTestPlaylist({ shuffle: true });
		player.loadPlaylist(playlist);
	});

	afterEach(() => {
		player.dispose();
	});

	it("generates shuffle order", async () => {
		await player.play();
		vi.runAllTimers();

		// First track is from shuffle order
		const status = player.getStatus();
		expect(status.currentTrack?.index).toBeGreaterThanOrEqual(0);
		expect(status.currentTrack?.index).toBeLessThan(3);
	});

	it("navigates through shuffle order", async () => {
		await player.play();
		vi.runAllTimers();

		const firstTrack = player.getStatus().currentTrack?.index;

		await player.skipNext();
		vi.runAllTimers();

		const secondTrack = player.getStatus().currentTrack?.index;

		// Should be different tracks
		expect(secondTrack).not.toBe(firstTrack);
	});

	it("toggles shuffle mode", () => {
		expect(player.getStatus().shuffle).toBe(true);

		player.toggleShuffle();
		expect(player.getStatus().shuffle).toBe(false);

		player.toggleShuffle();
		expect(player.getStatus().shuffle).toBe(true);
	});
});

describe("AudioPlayer - Volume Control", () => {
	let player: AudioPlayer;

	beforeEach(() => {
		player = createAudioPlayer();
		const playlist = createTestPlaylist();
		player.loadPlaylist(playlist);
	});

	afterEach(() => {
		player.dispose();
	});

	it("sets global volume", async () => {
		await player.play();
		vi.runAllTimers();

		player.setGlobalVolume(0.5);
		const status = player.getStatus();

		expect(status.globalVolume).toBe(0.5);
	});

	it("clamps volume to 0-1 range", () => {
		player.setGlobalVolume(-0.5);
		expect(player.getStatus().globalVolume).toBe(0);

		player.setGlobalVolume(1.5);
		expect(player.getStatus().globalVolume).toBe(1);
	});

	it("combines track volume with global volume", async () => {
		await player.play();
		vi.runAllTimers();

		player.setGlobalVolume(0.5);
		const status = player.getStatus();

		// Track 1 has volume 0.8, global is 0.5
		// Effective should be 0.8 * 0.5 = 0.4
		expect(status.currentTrack?.effectiveVolume).toBeCloseTo(0.4);
	});

	it("uses default volume when track has no volume", async () => {
		const playlist = createTestPlaylist();
		playlist.tracks[0].volume = undefined;
		player.loadPlaylist(playlist);

		await player.play();
		vi.runAllTimers();

		const status = player.getStatus();

		// Should use default_volume (0.7) * globalVolume (0.7) = 0.49
		expect(status.currentTrack?.effectiveVolume).toBeCloseTo(0.49);
	});
});

describe("AudioPlayer - Crossfade", () => {
	let player: AudioPlayer;

	beforeEach(() => {
		player = createAudioPlayer();
		const playlist = createTestPlaylist({ crossfade_duration: 2 });
		player.loadPlaylist(playlist);
	});

	afterEach(() => {
		player.dispose();
	});

	it("sets crossfade duration", () => {
		player.setCrossfadeDuration(5);
		expect(player.getStatus().crossfadeDuration).toBe(5);
	});

	it("clamps crossfade duration to 0-10 range", () => {
		player.setCrossfadeDuration(-1);
		expect(player.getStatus().crossfadeDuration).toBe(0);

		player.setCrossfadeDuration(15);
		expect(player.getStatus().crossfadeDuration).toBe(10);
	});

	it("initiates crossfade on skip", async () => {
		await player.play();
		vi.runAllTimers();

		await player.skipNext();
		vi.advanceTimersByTime(100);

		const status = player.getStatus();
		expect(status.state).toBe("crossfading");
	});

	it("completes crossfade after duration", async () => {
		await player.play();
		vi.runAllTimers();

		await player.skipNext();
		vi.advanceTimersByTime(2100); // Slightly more than crossfade duration

		const status = player.getStatus();
		expect(status.state).toBe("playing");
		expect(status.currentTrack?.index).toBe(1);
	});
});

describe("AudioPlayer - Status Subscriptions", () => {
	let player: AudioPlayer;

	beforeEach(() => {
		player = createAudioPlayer();
		const playlist = createTestPlaylist();
		player.loadPlaylist(playlist);
	});

	afterEach(() => {
		player.dispose();
	});

	it("notifies subscribers on status change", async () => {
		const statuses: PlaybackStatus[] = [];
		const unsubscribe = player.onStatusChange((status) => {
			statuses.push(status);
		});

		await player.play();
		vi.runAllTimers();

		expect(statuses.length).toBeGreaterThan(0);
		expect(statuses[statuses.length - 1].state).toBe("playing");

		unsubscribe();
	});

	it("allows unsubscribing", async () => {
		const statuses: PlaybackStatus[] = [];
		const unsubscribe = player.onStatusChange((status) => {
			statuses.push(status);
		});

		await player.play();
		vi.runAllTimers();

		const countAfterPlay = statuses.length;

		unsubscribe();

		player.pause();
		vi.runAllTimers();

		// Should not receive pause notification
		expect(statuses.length).toBe(countAfterPlay);
	});
});

describe("AudioPlayer - Edge Cases", () => {
	let player: AudioPlayer;

	beforeEach(() => {
		player = createAudioPlayer();
	});

	afterEach(() => {
		player.dispose();
	});

	it("handles play without playlist", async () => {
		await player.play();
		vi.runAllTimers();

		const status = player.getStatus();
		expect(status.state).toBe("idle");
	});

	it("handles empty playlist", async () => {
		const playlist = createTestPlaylist();
		playlist.tracks = [];
		player.loadPlaylist(playlist);

		await player.play();
		vi.runAllTimers();

		const status = player.getStatus();
		expect(status.state).toBe("idle");
	});

	it("handles invalid track index", async () => {
		const playlist = createTestPlaylist();
		player.loadPlaylist(playlist);

		await player.skipToTrack(999);
		vi.runAllTimers();

		const status = player.getStatus();
		expect(status.currentTrack).toBeNull();
	});

	it("cleans up on dispose", async () => {
		const playlist = createTestPlaylist();
		player.loadPlaylist(playlist);

		await player.play();
		vi.runAllTimers();

		player.dispose();

		const status = player.getStatus();
		expect(status.state).toBe("stopped");
		expect(status.playlist).toBeNull();
	});
});
