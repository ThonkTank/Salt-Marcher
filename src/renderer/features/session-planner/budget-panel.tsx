import type { SessionPlannerWorkspace } from '../../../shared/contracts/session-planner.js'
import { message } from '../../i18n/session-runtime.de.js'

export function BudgetPanel(props: {
  budget: SessionPlannerWorkspace['budget']
}) {
  return (
    <aside className="planner-budget" aria-label={message('planner.budget')}>
      <p className="section-kicker">{message('planner.budget')}</p>
      <h2>{props.budget.xpBudget} EP</h2>
      <dl>
        <div>
          <dt>{message('planner.planned')}</dt>
          <dd>{props.budget.plannedXp} EP</dd>
        </div>
        <div>
          <dt>
            {message(
              props.budget.remainingXp < 0 ? 'planner.exceeded' : 'planner.open'
            )}
          </dt>
          <dd>{Math.abs(props.budget.remainingXp)} EP</dd>
        </div>
        <div>
          <dt>{message('planner.shortRests')}</dt>
          <dd>{props.budget.recommendedShortRests}</dd>
        </div>
        <div>
          <dt>{message('planner.longRests')}</dt>
          <dd>{props.budget.recommendedLongRests}</dd>
        </div>
      </dl>
      <p>
        {props.budget.remainingXp < 0
          ? message('planner.overBudgetHint')
          : message('planner.budgetHint')}
      </p>
    </aside>
  )
}
