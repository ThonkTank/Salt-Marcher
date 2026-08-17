export const defaultSessionLayoutPreferenceValue = {
  schemaVersion: 2,
  controlPaneWidth: 300,
  scenarioPaneWidth: 264,
  centerTab: 'details'
} as const

export const sessionLayoutGeometry = Object.freeze({
  controlPane: Object.freeze({ min: 280, max: 440 }),
  scenarioPane: Object.freeze({ min: 264, max: 420 }),
  centerMinimumWidth: 360,
  dividerWidth: 9,
  compactMinimumWidth: 680
})
