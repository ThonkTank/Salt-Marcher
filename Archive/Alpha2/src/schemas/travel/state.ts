/**
 * Travel State Schema
 *
 * State types for the travel system.
 * Moved from services layer to allow cross-layer imports.
 *
 * @module schemas/travel/state
 */

import type { TokenState } from './token';
import type { Route } from './route';

/** Animation state for travel */
export type AnimationState =
	| { status: 'idle' }
	| { status: 'traveling'; pathIndex: number; progress: number }
	| { status: 'paused'; pathIndex: number };

/** Full state of the travel system */
export type TravelState = {
	token: TokenState;
	route: Route;
	animation: AnimationState;
};
