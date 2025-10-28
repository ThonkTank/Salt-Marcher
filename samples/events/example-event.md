---
id: event-blood-moon
title: Blood Moon Eclipse
summary: A crimson eclipse draws ominous tides and restless spirits.
tags:
  - astronomy
  - omen
schedule:
  type: recurring
  calendar: saltmarsh-standard
  intervalDays: 180
  offsetDay: 42
triggers:
  - type: playlist
    target: playlist-coastal-ambience
    mode: override
  - type: broadcast
    message: "A deep crimson moon rises over Saltmarsh."
effects:
  - type: weather
    region: coastal
    set: storm
  - type: faction-modifier
    factionId: faction-salt-guard
    modifier: -1
version: 1
---
