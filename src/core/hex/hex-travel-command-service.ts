import {
  hexTravelCommandSchema,
  hexTravelCommandReceiptSchema,
  hexTravelCommandStatusSchema,
  type HexTravelCommand
} from '../../shared/contracts/hex-travel-command.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { CampaignUnitOfWork } from '../application/campaign-unit-of-work.js'
import type { LivePlayService } from '../encounter/live-combat.js'
import type { SqliteDatabaseAccess } from '../persistence/sqlite/database-access.js'
import { SceneStore } from '../scene/scene-store.js'
import { WorldLocationStore } from '../worldplanner/location-store.js'
import { HexMapStore } from './hex-map-store.js'
import { HexRoutePlanStore } from './hex-route-plan-store.js'
import { HexTravelCommandJournal } from './hex-travel-command-journal.js'
import type { HexTravelService } from './hex-travel.js'

export class HexTravelCommandService {
  constructor(
    private readonly database: SqliteDatabaseAccess,
    private readonly travel: HexTravelService,
    private readonly play: LivePlayService
  ) {}

  readPlan(sceneId: string) {
    return this.database.use((db) => new HexRoutePlanStore(db).read(sceneId))
  }

  readState(sceneId: string) {
    return this.database.use((db) =>
      hexTravelCommandReceiptSchema.parse({
        context: this.context(sceneId),
        routePlan: new HexRoutePlanStore(db).read(sceneId)
      })
    )
  }

  status(value: HexTravelCommand) {
    const input = hexTravelCommandSchema.parse(value)
    return this.database.use((db) =>
      hexTravelCommandStatusSchema.parse({
        receipt: new HexTravelCommandJournal(db).read(input),
        context: this.context(input.command.input.sceneId),
        routePlan: new HexRoutePlanStore(db).read(input.command.input.sceneId)
      })
    )
  }

  execute(value: HexTravelCommand) {
    const input = hexTravelCommandSchema.parse(value)
    return this.database.use((db) =>
      new CampaignUnitOfWork(db).run(() => {
        const journal = new HexTravelCommandJournal(db)
        const existing = journal.read(input)
        if (existing) return existing
        const command = input.command
        const sceneId = command.input.sceneId
        const scenes = new SceneStore(db)
        if (scenes.focusedSceneId() !== sceneId)
          throw new CapabilityError('stale', false)
        const progressedPause = this.progressedPauseRevision(
          command,
          scenes.revision()
        )
        if (
          scenes.revision() !== command.input.expectedSceneRevision &&
          progressedPause === null
        )
          throw new CapabilityError('stale', true)
        const plans = new HexRoutePlanStore(db)
        switch (command.kind) {
          case 'save-plan': {
            const plan = command.input.plan
            if (plan) {
              const maps = new HexMapStore(db, new WorldLocationStore(db))
              maps.summary(plan.mapId)
              if (
                plan.waypoints.some(
                  (point) => !maps.tileExists(plan.mapId, point)
                )
              )
                throw new CapabilityError('validation_failed', false)
            }
            plans.save(sceneId, command.input.expectedPlanRevision, plan)
            break
          }
          case 'position':
            this.travel.position(command.input)
            break
          case 'start': {
            const { sceneId, mapId, waypoints, multiplier, expectedRevision } =
              command.input
            this.travel.start({
              sceneId,
              mapId,
              waypoints,
              multiplier,
              expectedRevision
            })
            break
          }
          case 'pause':
            this.travel.pause({
              sceneId,
              expectedRevision:
                progressedPause ?? command.input.expectedRevision
            })
            break
          case 'resume':
          case 'abort':
            this.travel[command.kind]({
              sceneId,
              expectedRevision: command.input.expectedRevision
            })
            break
          case 'set-multiplier':
            this.travel.setMultiplier({
              sceneId,
              multiplier: command.input.multiplier,
              expectedRevision: command.input.expectedRevision
            })
            break
        }
        const receipt = hexTravelCommandReceiptSchema.parse({
          context: this.context(sceneId),
          routePlan: plans.read(sceneId)
        })
        journal.record(input, receipt)
        return receipt
      })
    )
  }

  /** A completed hex advances all three counters once; any other change stays a conflict. */
  private progressedPauseRevision(
    command: HexTravelCommand['command'],
    sceneRevision: number
  ): number | null {
    if (
      command.kind !== 'pause' ||
      command.input.expectedProgressIndex === undefined
    )
      return null
    const current = this.travel.read(command.input.sceneId)
    const steps = current.currentIndex - command.input.expectedProgressIndex
    if (
      current.status !== 'travelling' ||
      steps <= 0 ||
      current.revision - command.input.expectedRevision !== steps ||
      sceneRevision - command.input.expectedSceneRevision !== steps
    )
      return null
    return current.revision
  }

  private context(sceneId: string) {
    return {
      travel: this.travel.read(sceneId),
      session: this.play.readSession()
    }
  }
}
