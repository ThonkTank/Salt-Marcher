Build successful. The refactoring is complete:

`connectionCandidates` is now a clean three-line orchestrator:
```java
var candidates = new ArrayList<ConnectionCandidate>();
candidates.addAll(sharedDoorCandidates(context, room, connectedRoomIds));
candidates.addAll(corridorJoinCandidates(room, corridorCells, context));
candidates.addAll(freshPathCandidates(context, room, connectedRoomIds));
return List.copyOf(candidates);
```

Changes made:
- **`sharedDoorCandidates`**: absorbed the guard condition (`waypointCells.isEmpty && totalRoomCount <= 2`) — returns `List.of()` early if not a pure room-pair corridor
- **`corridorJoinCandidates`**: replaced `roomOccupancy` + `roomExits` parameters with `context`; computes `roomExits` internally
- **`freshPathCandidates`**: removed `roomExits` parameter; computes it internally
- Removed now-unused `Map` import
