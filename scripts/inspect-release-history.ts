import {
  historicalReleaseSources,
  inspectHistoricalSource
} from './qualification/historical-release-sources.js'

console.info(
  JSON.stringify(
    {
      formatVersion: 1,
      evidence: 'source-inspection-only',
      sources: historicalReleaseSources.map((source) =>
        inspectHistoricalSource(process.cwd(), source)
      )
    },
    null,
    2
  )
)
