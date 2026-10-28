import type { VegetationInstance, VegetationView } from './vegetation-contracts';

/** Disposable transport only. Authored overrides stay verbatim in the tail;
 * generated doubles are lossless, including at distant world coordinates. */
export type VegetationProjection =
  | VegetationView
  | {
      mode: VegetationView['mode'];
      packed: { version: 1; ids: string[]; data: string };
      tail: VegetationInstance[];
    };
