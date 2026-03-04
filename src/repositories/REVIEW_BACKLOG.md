# Review Backlog: src/repositories

## [LOW] LinkedHashMap Static Initializer Style
**File:** CreatureRepository.java:402-421
**Description:** `CR_TO_XP` uses a `LinkedHashMap` with a 20-line static initializer block of paired `put` calls. This is idiomatic pre-records Java but somewhat awkward to read and easy to miscount. A `Map.ofEntries` factory approach would be more concise and eliminate mutable static state. However, the current implementation is correct and stable -- stylistic only.
**Suggested fix:** Optional refactoring: Replace with `Map.copyOf(Map.ofEntries(...))` for immutable insertion-ordered map. Acceptable as-is if not addressed.
