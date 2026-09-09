import { desktopXpDraftId } from './desktop-xp-draft-id.js'
import { DesktopXpAction } from './desktop-xp-action.js'
import type { ReactNode } from 'react'
import { message, formatMessage } from '../../i18n/session-runtime.de.js'
import { lazy, Suspense, useState } from 'react'
import type { PartyCharacter } from '../../../shared/contracts/party.js'
import type { CharacterComparison } from '../../../shared/contracts/scene-desktop.js'

const Ledger = lazy(async () => ({
  default: (await import('../loot/character-loot-ledger-dialog.js'))
    .CharacterLootLedgerDialog
}))
const passives = [
  ['passivePerception', message('character.perception')],
  ['passiveInsight', message('character.insight')],
  ['passiveInvestigation', message('character.investigation')]
] as const

function characterMatchesComparison(
  member: PartyCharacter,
  comparison: CharacterComparison
): boolean {
  return (
    (!comparison.language ||
      member.languages.some(
        (language) =>
          language.toLocaleLowerCase('de-DE') ===
          comparison.language.toLocaleLowerCase('de-DE')
      )) &&
    (comparison.minimum === null ||
      (member[comparison.passive] !== null &&
        member[comparison.passive]! >= comparison.minimum))
  )
}

export function DesktopCharacters(props: {
  sceneId?: string
  campaignId?: string
  partyRevision?: number
  actions?: ReactNode
  members: readonly PartyCharacter[]
  comparison: CharacterComparison
  change: (comparison: CharacterComparison) => void
  openCharacter: ((id: string) => void) | undefined
  onError: (message: string) => void
}) {
  const [ledger, setLedger] = useState<PartyCharacter | null>(null)
  const comparison = props.comparison
  const languages = [
    ...new Set([
      ...props.members.flatMap((member) => member.languages),
      ...(comparison.language ? [comparison.language] : [])
    ])
  ].sort((a, b) => a.localeCompare(b, 'de'))
  const comparing = !!comparison.language || comparison.minimum !== null
  return (
    <div className="desktop-characters">
      {props.actions}
      <div className="desktop-character-comparison">
        <select
          aria-label={message('character.compareLanguage')}
          value={comparison.language}
          onChange={(event) =>
            props.change({ ...comparison, language: event.target.value })
          }
        >
          <option value="">{message('character.allLanguages')}</option>
          {languages.map((language) => (
            <option key={language}>{language}</option>
          ))}
        </select>
        <select
          aria-label={message('character.comparePassive')}
          value={comparison.passive}
          onChange={(event) =>
            props.change({
              ...comparison,
              passive: event.target.value as CharacterComparison['passive']
            })
          }
        >
          {passives.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <input
          aria-label={message('character.minimum')}
          type="number"
          min={0}
          max={99}
          placeholder="≥"
          value={comparison.minimum ?? ''}
          onChange={(event) => {
            const value =
              event.target.value === '' ? null : Number(event.target.value)
            if (
              value === null ||
              (Number.isInteger(value) && value >= 0 && value <= 99)
            )
              props.change({ ...comparison, minimum: value })
          }}
        />
      </div>
      <table className="desktop-character-table">
        <thead>
          <tr>
            <th>{message('character.identity')}</th>
            {passives.map(([key, label]) => (
              <th key={key} title={message(`character.${key}`)}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        {props.members.map((member) => (
          <tbody
            key={member.id}
            data-character-id={member.id}
            data-match={
              comparing && characterMatchesComparison(member, comparison)
            }
          >
            <tr>
              <th scope="row">
                <strong>{member.name}</strong>
                <small>
                  {member.playerName ?? '—'} ·{' '}
                  {formatMessage('character.levelValue', {
                    level: member.level ?? '—'
                  })}
                </small>
                <small>
                  XP {member.xp} / {member.nextLevelXp ?? '—'}
                </small>
                <CharacterBurden member={member} />
              </th>
              {passives.map(([key]) => (
                <td key={key}>{member[key] ?? '—'}</td>
              ))}
            </tr>
            <tr>
              <td colSpan={4}>
                <div className="desktop-character-footer">
                  <span>{member.languages.join(', ') || '—'}</span>
                  {props.campaignId && props.partyRevision !== undefined && (
                    <DesktopXpAction
                      maintenanceId={
                        props.sceneId
                          ? desktopXpDraftId(
                              props.campaignId,
                              props.sceneId,
                              member.id
                            )
                          : undefined
                      }
                      campaignId={props.campaignId}
                      member={member}
                      revision={props.partyRevision}
                    />
                  )}
                  <button onClick={() => setLedger(member)}>
                    {message('character.loot')}
                  </button>
                  {props.openCharacter && (
                    <button onClick={() => props.openCharacter?.(member.id)}>
                      {message('character.catalog')}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        ))}
      </table>
      {!props.members.length && <p>{message('character.emptyScene')}</p>}
      <Suspense fallback={null}>
        {ledger && (
          <Ledger
            character={ledger}
            close={() => setLedger(null)}
            onError={props.onError}
          />
        )}
      </Suspense>
    </div>
  )
}

function CharacterBurden({ member }: { member: PartyCharacter }) {
  const budget = member.burden?.dailyBudget
  return (
    <small className="desktop-character-burden">
      {(['short', 'long'] as const).map((kind, index) => {
        const trusted =
          kind === 'short'
            ? member.burden?.shortTrusted
            : member.burden?.longTrusted
        const used =
          kind === 'short' ? member.xpSinceShortRest : member.xpSinceLongRest
        const threshold = budget
          ? kind === 'short'
            ? Math.ceil(budget / 3)
            : budget
          : null
        const due = trusted && threshold !== null && used >= threshold
        return (
          <span
            key={kind}
            title={
              !trusted
                ? message('rest.unknown')
                : due
                  ? message(kind === 'short' ? 'rest.shortDue' : 'rest.longDue')
                  : undefined
            }
            data-due={due}
          >
            {index > 0 ? ' · ' : ''}
            {message(
              kind === 'short' ? 'rest.shortLoad' : 'rest.longLoad'
            )}{' '}
            {used}
            {trusted
              ? ` / ${threshold ?? '—'}`
              : ` (${message('rest.unknown')})`}
            {due ? ' !' : ''}
          </span>
        )
      })}
    </small>
  )
}
