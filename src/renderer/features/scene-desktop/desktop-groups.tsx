import { message } from '../../i18n/session-runtime.de.js'
import type { GroupDrag } from './desktop-group-drop.js'
import { groupDragMime } from './desktop-group-drop.js'
import { SessionGroupCard } from '../session/session-group-card.js'
import { CompactRegister } from '../shared/compact-register.js'
import type {
  SessionWorkspaceActions,
  SessionWorkspaceViewModel
} from '../session/session-workspace-model.js'
export function DesktopGroups(props: {
  campaignId: string
  model: SessionWorkspaceViewModel
  actions: SessionWorkspaceActions
  selection: readonly string[]
  start: (drag: GroupDrag) => void
  cancel: () => void
}) {
  const rows = [
    ...props.model.groups.activeRows,
    ...props.model.groups.archivedRows
  ]
  return (
    <div
      role="group"
      className="desktop-groups"
      aria-label={message('groupWindow.title')}
    >
      <div className="desktop-section-heading">
        <button
          aria-label={message('groupWindow.edit')}
          onClick={props.actions.manageGroups}
        >
          {message('groupWindow.manage')}
        </button>
      </div>
      {rows.map((row) => {
        if (row.kind !== 'active-group' && row.kind !== 'archived-group')
          return null
        const group = row.group
        const drag = {
          campaignId: props.campaignId,
          sceneId: props.model.focused.id,
          groupId: group.id
        }
        const enabled =
          !group.archived && group.entries.some((e) => e.aliveQuantity > 0)
        return (
          <div key={group.id} className="desktop-draggable-group">
            <button
              className="desktop-group-grip"
              disabled={!enabled}
              draggable={enabled}
              aria-label={`${group.name} ziehen`}
              onPointerDown={(e) => e.stopPropagation()}
              onDragStart={(e) => {
                e.stopPropagation()
                e.dataTransfer.setData(groupDragMime, JSON.stringify(drag))
                e.dataTransfer.effectAllowed = 'copy'
                props.start(drag)
              }}
              onDragEnd={props.cancel}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  props.start(drag)
                }
              }}
            >
              ⠿
            </button>
            <div className="desktop-group-content">
              <CompactRegister
                className="group-register"
                label={group.name}
                columns={['Status', 'Gruppe', 'Zahl', 'XP', 'Aktionen']}
              >
                <SessionGroupCard row={row} actions={props.actions} />
              </CompactRegister>
              {props.selection.includes(group.id) && (
                <small>{message('groupWindow.selected')}</small>
              )}
              {row.expanded && (
                <div className="desktop-group-status">
                  {group.entries.flatMap((entry) =>
                    entry.members.map((member, i) => (
                      <div key={member.id}>
                        <span>
                          {entry.displayName} {i + 1}
                        </span>
                        <span>
                          {member.currentHp} {message('groupWindow.hp')}
                          {member.conditions.length
                            ? ` · ${member.conditions.join(', ')}`
                            : ''}
                          {member.concentrating ? ' · Concentration' : ''}
                          {member.exhaustionLevel
                            ? ` · Exhaustion ${member.exhaustionLevel}`
                            : ''}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
