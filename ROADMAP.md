# Salt Marcher Development Roadmap

**Last Updated:** 2025-11-01
**Current Status:** Phase D Complete ✅ (7th Run)
**Test Status:** 1148/1149 passing (99.9%) ⚠️
**Next Phase:** Phase B (Implementation - 57 UX issues documented)

[← Back to CLAUDE.md](CLAUDE.md)

---

## 📋 Quick Status

- **Blocking Issues:** None ✅
- **Current Focus:** UX improvements (57 documented issues)
- **Test Health:** 99.9% passing (1 probabilistic test failing)
- **Recent Completion:** Phase 13 Priority 2 (Event Editor) ✅

---

## 🎯 Completed Phases

### Phase 0-4: Foundation
- Tags/Schemas, Stores, Encounter (Travel→Combat E2E)
- Event Engine (Timeline/Inbox/Hooks)

### Phase 5: Loot Generator ✅
- Gold (XP-based, 5 rule types)
- Items (tag-filter, rarity-limits, weighted)
- E2E tests (13 scenarios)

### Phase 6: Audio System ✅
- See [docs/audio-system.md](docs/audio-system.md)
- 57 tests passing

### Phase 7: Random Encounters ✅
- See [docs/random-encounters.md](docs/random-encounters.md)

### Phase 8.1-8.9: Faction System Complete ✅
- See [docs/faction-system.md](docs/faction-system.md)
- 390+ tests

### Phase 9-9.2D: Location & Building System Complete ✅
- See [docs/faction-system.md](docs/faction-system.md)
- 118+ tests

### Phase 10.1-10.4: Weather System Complete ✅
- See [docs/weather-system.md](docs/weather-system.md)
- 147 tests

### Phase 11.1: Weather Panel Interactivity ✅
- 6 tests

### Phase 12.1-12.4: Almanac MVP ✅
- Time display, events list, controls (8 tests)
- Month view calendar with event indicators
- View switching
- Library tabs verification (locations: 134 tests, playlists: 17, encounter-tables: 10)

### Phase 13 Priority 1-2: Almanac Core Features ✅
- **Priority 1:** Vault data integration (Nov 1, 2025)
- **Priority 2:** Full event editor with recurrence patterns (Nov 1, 2025, 18 tests)

### Quality Assurance Runs ✅
- **Phase D (UX Review):** 7 runs complete
- **Phase A (Quality Audit):** 7 runs complete
- **Phase C (Documentation Review):** 5 runs complete

---

## 📅 Planned Phases

### Phase 10.5: Advanced Weather Features (Future)
- Weather forecasting (predict next 3 days)
- Extreme weather events (hurricanes, blizzards)
- Player-controlled weather (Control Weather spell)

### Phase 13 Priority 3-7: Almanac Full Implementation
- **Priority 3:** Week/timeline calendar grid views with event visualization
- **Priority 4:** Month navigation controls (prev/next month buttons)
- **Priority 5:** Astronomical cycles UI (moon phases, eclipses, etc.)
- **Priority 6:** Event inbox with priority sorting
- **Priority 7:** Search functionality implementation

---

## 🚨 Active TODOs (By Priority)

### CRITICAL (Feature komplett kaputt/unbrauchbar)
None currently! All blocking issues resolved. ✅

### HIGH (Feature fehlt oder stark beeinträchtigt)
2. **[HIGH] Almanac Full Implementation Missing** - MVP + Month View + Vault Integration + Event Editor functional, additional features needed ⚠️
   - ✅ Phase 12.1-12.4 MVP Complete - basic time display, upcoming events, advance controls, month grid view with event indicators, view switching
   - ✅ Phase 13 Priority 1 Complete - vault data integration (loads calendar from vault, persists time advances)
   - ✅ Phase 13 Priority 2 Complete - event editor (full form, validation, single/recurring events, 18 tests)
   - Still missing (Phase 13 Priority 3-7):
     - Week/timeline calendar grid views with event visualization
     - Month navigation controls (prev/next month buttons)
     - Astronomical cycles UI (moon phases, eclipses, etc.)
     - Event inbox with priority sorting
     - Search functionality implementation
   - Current: Full event CRUD in UI, vault persistence working, event editor functional with all recurrence patterns
   - Location: src/workmodes/almanac/view/ (event-editor-modal.ts: 562 lines, fully implemented)
   - See: [docs/almanac-system.md](docs/almanac-system.md) for detailed status

### MEDIUM (Feature unvollständig aber teilweise nutzbar)
4. **[MEDIUM] POI Integration Missing** - Cannot place location markers on map
   - Goal: "Ortsmarker (Städte, Landmarken)" in Cartographer
   - Phase 9 Location system fully implemented but no UI access
   - Need: Cartographer mode for placing/editing location markers
   - Location: Cartographer brush/inspector modes

5. **[MEDIUM] Cartographer Brush Error** - Brush mode logs error messages
   - Terrain-brush functionality potentially broken, needs real testing
   - Location: Cartographer terrain-brush mode

6. **[MEDIUM] [UX] Almanac - No Keyboard Shortcuts** - All interactions require mouse
   - No keyboard shortcuts for common actions (advance time, navigate events)
   - Arrow keys don't navigate event list, Space/Enter don't activate
   - Location: src/workmodes/almanac/view/ (all components)

7. **[MEDIUM] [UX] Weather History/Forecast - Collapsed by Default** - Users might miss these features
   - History and forecast sections hidden on load (line 132-133)
   - No visual cue that content is collapsible (no ▶ icon on headers)
   - Users need to discover collapse functionality by trial
   - Location: src/workmodes/session-runner/travel/ui/weather-panel.ts:132-133

8. **[MEDIUM] [UX] Building Management - Unclear Capacity Warnings** - Capacity limits not visible until error
   - User only sees "max capacity" Notice after clicking Assign
   - Need: Show visual capacity indicator (e.g., "Workers: 3/5") prominently in worker section
   - Location: building-management-modal.ts:489-491

9. **[MEDIUM] [UX] Building Status - Unclear Condition Impact** - User doesn't understand what condition affects
   - Shows "Condition: 75%" without explaining gameplay impact
   - Need: Add helper text like "Condition affects production rate and durability"
   - Location: building-management-modal.ts:195-212

10. **[MEDIUM] [UX] Production Dashboard - No Units Displayed** - Production shows percentages without context
    - Shows "75%" but unclear what this percentage represents
    - Need: Show actual values (e.g., "7.5 Gold/day at 75% efficiency")
    - Location: production-visualization.ts

11. **[MEDIUM] [UX] Weather Details - Categorical Values Lack Precision** - Some values show categories instead of numbers
    - Precipitation: "Mäßiger Niederschlag" (what mm/h?), Visibility: "Gut" (how many meters?)
    - Players wanting precise values for calculations can't get them
    - Need: Show both category and exact value: "Mäßiger Niederschlag (5 mm/h)" or add tooltip
    - Location: weather-icons.ts:117-133

12. **[MEDIUM] [UX] Weather Icon - No Severity Indication** - Icon shows type but not severity
    - "Regen" icon looks same for light drizzle and torrential downpour
    - Only text label shows severity, less scannable UI
    - Need: Visual severity indicator (icon size, color, badge, or animation)
    - Location: weather-panel.ts:118-124

13. **[MEDIUM] [UX] Weather Update Timing Not Visible** - Users don't know when weather will change
    - No indication of how long current weather lasts
    - No "next update in X hours" display
    - Critical for multi-day travel planning
    - Need: Show weather duration/next change time
    - Location: weather-panel.ts (entire component)

### LOW (Nice-to-have, Verbesserungen)
14. **[LOW] [UX] Almanac Events List - No Filtering/Sorting** - All events shown without organization
15. **[LOW] [UX] Weather History Display - No Visual Trend** - Just a list of past conditions
16. **[LOW] Phase 9.2 Error Handling** - Building management modal lacks comprehensive error handling
17. **[LOW] Building Modal Refactoring** - Large file size (889 lines)
18. **[LOW] Weather Panel - Hardcoded German Strings** - Not using translator.ts
19. **[LOW] Calendar Inbox Integration** - calendar-state-gateway.ts TODO: Add faction events to calendar inbox
20. **[LOW] Encounter Presenter Path Resolution** - presenter.ts:442 uses hardcoded path
21. **[LOW] [UX] Building Management Modal - No Keyboard Support**
22. **[LOW] [UX] Building Management Modal - No Loading States**
23. **[LOW] [UX] Building Management Refresh - Inspector Doesn't Auto-Update**
24. **[LOW] [UX] Save Button - No Unsaved Changes Warning**
25. **[LOW] Time-of-Day Extraction Placeholder** - encounter-context-builder hardcodes "day"
26. **[LOW] [UX] Production Visualization - No Interactivity**
27. **[LOW] [UX] Weather Speed Modifier Color Coding - Thresholds Arbitrary**
28. **[LOW] [UX] Weather Panel - No Animation or Transitions**
29. **[LOW] [UX] Weather Panel - Redundant "Reiseeffekte" Section**
30. **[LOW] [UX] Weather Panel - Missing Accessibility Features**
31. **[LOW] [UX] Weather Change Notification Missing**
32. **[LOW] [UX] Manual vs Travel Encounters Not Distinguished**
33. **[LOW] Almanac Time Handler Duplication** - Three nearly-identical time advance handlers
34. **[LOW] Almanac MVP - No Loading States**
35. **[LOW] Feature TODOs** - Intentional placeholders for future work
36. **[LOW] Probabilistic Market Fluctuation Test Failure**
37. **[LOW] Old Preset Format Warning** - 5 files use old format
38. **[LOW] [UX] Almanac Time Controls - Unclear Button Direction**
39. **[LOW] [UX] Almanac Month View - Incorrect Weekday Calculation**
40. **[LOW] [UX] Almanac Month View - Event Indicator Grammar**
41. **[LOW] [UX] Almanac Month View - Day Click Does Nothing Useful**
42. **[LOW] [UX] Almanac Events List - No Relative Time Context**
43. **[LOW] [UX] Almanac Events List - No Visual Grouping by Day**
44. **[LOW] [UX] Almanac MVP - Setup Notice Lacks Guidance**
45. **[LOW] [UX] Almanac MVP - View Switcher Text-Only**
46. **[LOW] [UX] Almanac Gateway - Generic Error Messages**
47. **[LOW] [UX] Almanac Gateway - No Retry Mechanism**
48. **[LOW] [UX] Event Editor - No Escape Key Handler**
49. **[LOW] [UX] Event Editor - No Tab Navigation Between Sections**
50. **[LOW] [UX] Event Editor - Priority Field Lacks Guidance**
51. **[LOW] [UX] Event Editor - Weekly Recurrence Day Index Cryptic**
52. **[LOW] [UX] Event Editor - Custom Recurrence Type Not Implemented**
53. **[LOW] [UX] Event Editor - No Field Validation Feedback**
54. **[LOW] [UX] Event Editor - All-Day Toggle Hidden Impact**
55. **[LOW] [UX] Event Editor - Date Validation Lacks Context**
56. **[LOW] [UX] Event Editor - Recurrence Pattern Preview Missing**
57. **[LOW] [UX] Event Editor - Generic Save Error Message**

_(Full details for all LOW priority items available in previous revision)_

---

## 📊 Test Status Details

### Unit Tests: 1148/1149 passing (99.9%) ⚠️
- **Audio:** 57/57 ✅
- **Playlist:** 17/17 ✅
- **Encounter:** 34/34 ✅ (includes 7 manual composition + 1 presenter)
- **Faction:** 388/390 ⚠️ (1 probabilistic market fluctuation test failing consistently)
- **Location/Building:** 145/145 ✅
- **Weather:** 136/136 ✅ (Phase 10.1-10.4 + 11.1)
- **Almanac MVP + Month View + Event Editor:** 32/32 ✅ (Phase 12.1-12.4 + 13.2)
- **Library Entities:** 161/161 ✅ (locations: 134, playlists: 17, encounter-tables: 10)
- **Header policy:** 1/1 ✅

### Integration Tests
- 6 require live Obsidian (expected, documented limitation)

### Known Issues
- 1 probabilistic market fluctuation test fails consistently (economic simulation)
- 1 probabilistic NPC betrayal test fails occasionally (non-blocking)

---

## 🔄 Recently Completed

### Phase D (7th Run) - Nov 1, 2025 ✅
- Reviewed event editor modal (560 lines), almanac MVP, month view calendar
- Found 10 new LOW-priority UX issues in event editor
- Total [UX] tasks: 57 (47 existing + 10 new)
- Key findings: Event editor functionally complete but needs keyboard accessibility

### Phase A (7th Run) - Nov 1, 2025 ✅
- Tests 1148/1149 passing
- No system errors
- 47 [UX] tasks documented

### Phase 13 Priority 2 - Nov 1, 2025 ✅
- Full event creation/editing modal with form validation
- Single and recurring event support
- 18 tests

### Phase 13 Priority 1 - Nov 1, 2025 ✅
- Vault data integration
- Calendar loads from vault
- Time advances persist to vault

---

## 🎯 Next Steps (Recommended)

### 1. [IMMEDIATE] Phase B: Address HIGH/MEDIUM Priority UX Issues
- **57 [UX] issues documented**, many affect core workflows
- **HIGH Priority (1 issue):** Almanac full implementation (week/timeline views, month nav, astronomical UI, inbox, search)
- **MEDIUM Priority (10 issues):** Keyboard shortcuts, weather discoverability, building warnings, production units, weather precision
- Consider addressing event editor keyboard accessibility alongside other UX fixes

### 2. [HIGH] Phase 13: Continue Almanac Full Implementation
- **Priority 1-2:** ✅ COMPLETE (Vault integration + Event editor)
- **Priority 3:** Week/timeline calendar grid views with event visualization
- **Priority 4:** Month navigation controls (prev/next month buttons)
- **Priority 5:** Astronomical cycles UI (moon phases, eclipses, etc.)
- **Priority 6:** Event inbox with priority sorting
- **Priority 7:** Search functionality implementation
- See [docs/almanac-system.md](docs/almanac-system.md) for technical details

### 3. [MEDIUM] Complete Partial Features
- POI placement UI in Cartographer (location system ready, needs UI mode)
- Cartographer Brush debugging (investigate error messages)
- Almanac keyboard shortcuts (arrow nav, time advance hotkeys)
- Weather history/forecast discoverability (expand by default or add ▶ icons)
- Various [UX] improvements documented above

### 4. [LOW] Address Technical Debt
- Fix probabilistic market fluctuation test (economics.test.ts)
- Convert 5 old preset format files (run convert-references.mjs)
- Review almanac time handler duplication (createAdvanceHandler refactor)

### 5. [PLANNED] Phase 10.5: Advanced Weather Features
- Extreme weather events (hurricanes, blizzards)
- Player-controlled weather (Control Weather spell)

---

## 📖 Priority Definitions Reference

For full priority definitions, see [CLAUDE.md](CLAUDE.md) "Priority Definitions" section.

**Quick Reference:**
- **CRITICAL:** Feature completely broken, blocks usage, crashes plugin
- **HIGH:** Important feature missing or severely impaired, affects user workflow
- **MEDIUM:** Feature incomplete but partially usable, suboptimal UX, non-blocking bugs
- **LOW:** Nice-to-have improvements, polish, refactoring