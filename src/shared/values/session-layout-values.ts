export const defaultSessionLayoutPreferenceValue = {
  controlPaneWidth: 300,
  scenarioPaneWidth: 264,
  centerTab: 'details'
} as const

export const sessionLayoutGeometry = Object.freeze({
  controlPane: Object.freeze({ min: 280, max: 440 }),
  scenarioPane: Object.freeze({ min: 264, max: 420 }),
  centerMinimumWidth: 360,
  dividerWidth: 9
})
