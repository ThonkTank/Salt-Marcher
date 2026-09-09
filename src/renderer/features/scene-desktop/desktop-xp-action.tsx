import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type {
  PartyCharacter,
  PartyCharacterCommand
} from '../../../shared/contracts/party.js'
import { AnchoredPopup } from '../../shell/anchored-popup.js'
import { message } from '../../i18n/session-runtime.de.js'
import {
  draftConcern,
  maintenanceDraftCoordinator
} from '../../shell/maintenance-draft-coordinator.js'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import { CharacterCommandController } from '../party/character-command-controller.js'
import { useCharacterCommandPort } from '../party/use-character-command-port.js'

type Mode = 'add' | 'subtract' | 'set'
export function DesktopXpAction(props: {
  campaignId: string
  sceneId?: string
  windowId?: string
  maintenanceId?: string | undefined
  member: PartyCharacter
  revision: number
}) {
  const port = useCharacterCommandPort(props.campaignId)
  const [controller] = useState(() => new CharacterCommandController(port))
  const command = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot
  )
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const amountRef = useRef('')
  const confirmedAmount = useRef('')
  const intent = useRef<Mode | null>(null)
  const [error, setError] = useState<string | null>(null)
  useLayoutEffect(() => {
    controller.attach(() => {
      confirmedAmount.current = amountRef.current
      intent.current = null
      setError(null)
    })
  })
  useLayoutEffect(() => controller.detach, [controller])
  const dirty = () =>
    controller.unresolved() ||
    intent.current !== null ||
    amountRef.current !== confirmedAmount.current
  const blocked = useMaintenanceDraft(
    {
      label: `XP: ${props.member.name}`,
      concerns: [
        draftConcern.character(props.member.id),
        ...(props.sceneId ? [draftConcern.scene(props.sceneId)] : []),
        ...(props.windowId ? [draftConcern.window(props.windowId)] : [])
      ],
      isDirty: dirty,
      save: async () => {
        if (!(await controller.settle())) return false
        if (!dirty()) return true
        if (intent.current) return write(intent.current, true)
        setError(message('xp.chooseAction'))
        throw new Error(message('xp.chooseAction'))
      },
      discard: async () => {
        if (!(await controller.settle())) return false
        if (!controller.reset()) return false
        amountRef.current = ''
        confirmedAmount.current = ''
        intent.current = null
        setAmount('')
        setOpen(false)
        setError(null)
        return true
      }
    },
    props.maintenanceId
  )
  const busy = blocked || command.busy || command.uncertain
  const publicBlocked = () =>
    maintenanceDraftCoordinator.isLocked() ||
    controller.unresolved() ||
    controller.snapshot().conflict
  async function write(mode: Mode, maintenance = false): Promise<boolean> {
    if (
      (!maintenance && publicBlocked()) ||
      controller.unresolved() ||
      controller.snapshot().conflict
    )
      return false
    const text = amountRef.current
    const value = Number(text)
    if (
      !text.trim() ||
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > 1_000_000
    ) {
      setError(message('character.valueError'))
      return false
    }
    setError(null)
    intent.current = mode
    const base = { id: props.member.id, expectedRevision: props.revision }
    const input: PartyCharacterCommand = {
      commandId: crypto.randomUUID(),
      command:
        mode === 'set'
          ? { kind: 'set-xp', input: { ...base, amount: value } }
          : {
              kind: 'adjust-xp',
              input: { ...base, delta: mode === 'add' ? value : -value }
            }
    }
    return controller.execute(input)
  }
  return (
    <>
      <button
        disabled={blocked || command.busy}
        onClick={(event) => {
          if (maintenanceDraftCoordinator.isLocked() || command.busy) return
          setAnchor(event.currentTarget)
          setOpen(!open)
        }}
      >
        {message('xp.action')}
      </button>
      <AnchoredPopup
        open={open}
        anchor={anchor}
        onDismiss={() => {
          if (
            !maintenanceDraftCoordinator.isLocked() &&
            !controller.unresolved()
          )
            setOpen(false)
        }}
        className="desktop-xp-popup"
      >
        <div>
          <input
            type="number"
            aria-label={message('xp.amount')}
            min={0}
            max={1_000_000}
            value={amount}
            disabled={busy || command.conflict}
            onChange={(event) => {
              if (publicBlocked()) return
              amountRef.current = event.target.value
              intent.current = null
              setAmount(event.target.value)
            }}
          />
          <button
            disabled={busy || command.conflict}
            onClick={() => void write('add')}
          >
            +
          </button>
          <button
            disabled={busy || command.conflict}
            onClick={() => void write('subtract')}
          >
            −
          </button>
          <button
            disabled={busy || command.conflict}
            onClick={() => void write('set')}
          >
            {message('xp.set')}
          </button>
        </div>
        {(command.error || error) && (
          <p role="alert">{command.error || error}</p>
        )}
        {command.uncertain && (
          <button
            disabled={blocked || command.busy}
            onClick={() => {
              if (!maintenanceDraftCoordinator.isLocked())
                void controller.settle()
            }}
          >
            {message('character.checkSavedState')}
          </button>
        )}
      </AnchoredPopup>
    </>
  )
}
