/**
 * DetailView - Public API
 *
 * Context-dependent detail panels for SessionRunner companion view.
 * Shows Encounter, Combat tabs (MVP), with more tabs to be added later.
 */

export { VIEW_TYPE_DETAIL_VIEW } from './types';
export type {
  TabId,
  DetailViewState,
  DetailViewRenderHint,
  DetailViewRenderCallback,
  EncounterTabState,
  CombatTabState,
} from './types';

export { DetailView, createDetailViewFactory } from './view';
export type { DetailViewDeps } from './view';

export { createDetailViewModel } from './viewmodel';
export type { DetailViewModelDeps, DetailViewModel } from './viewmodel';
