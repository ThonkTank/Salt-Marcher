---
id: playlist-coastal-ambience
name: Coastal Ambience
summary: Gentle waves, gulls, and creaking docks.
tags:
  - coastal
  - calm
allowShuffle: true
fade:
  in: 3
  out: 4
tracks:
  - id: seagulls
    title: Seagulls and Waves
    url: media://audio/seagulls.mp3
    weight: 1
  - id: storm-warning
    title: Distant Storm Warning
    url: media://audio/storm.wav
    weight: 0.3
rules:
  - when:
      weather: storm
      timeOfDay: night
    action: prefer
    trackId: storm-warning
version: 1
---
