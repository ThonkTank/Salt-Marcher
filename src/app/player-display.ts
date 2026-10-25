import type { PlayerFrame } from './player-contracts';
import { renderPlayer } from './player-render';
declare global {
  interface Window {
    playerDisplay: {
      frame: () => Promise<{ ok: boolean; value?: { generation: number; frame: PlayerFrame } }>;
      onFrame: (callback: (value: { generation: number; frame: PlayerFrame }) => void) => void;
    };
  }
}
let generation = -1;
const stage = document.getElementById('player-stage')!;
function receive(value: { generation: number; frame: PlayerFrame }) {
  if (value.generation < generation) return;
  generation = value.generation;
  renderPlayer(stage, value.frame);
}
window.playerDisplay.onFrame(receive);
void window.playerDisplay.frame().then((result) => {
  if (result.ok && result.value) receive(result.value);
});
