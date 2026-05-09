# Passive View Enforcement Slice

This directory now hosts only the passive-`View` subset of the merged
`checkViewEnforcement` bundle.

It owns the passive-`View` compile-bound checkers plus the shared FXML
resource validation support used by the merged root task:

- `errorprone/`
  `PassiveViewDependencyBoundaries`, `PassiveViewLocalStateBoundary`,
  `PassiveViewProjectInteractionBoundary`,
  `PassiveViewProjectionConstructionBoundary`, `ViewPresentationDecisionLeak`,
  `ViewInputEventApi`, and `PassiveViewCallbackSeamBoundary`
- `support/`
  passive-`View` FXML resource validation runner
- `tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/StandardEnforcementBundles.kt`
  merged View bundle registry entry and root task wiring

Public bundle entrypoint:

- `./gradlew checkViewEnforcement --rerun-tasks --console=plain`
