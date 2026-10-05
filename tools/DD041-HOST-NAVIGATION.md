# DD-041 host check

`tools/dd041-host-navigation.cjs` is a focused workflow for the isolated Obsidian test host. `tools/host-test.cjs` selects it with `--dd041-navigation`; `tools/run-dd041-host.sh` supplies a separate QA directory and port. The wrapper holds the shared graphics lock through `tools/run-host.sh`. It must run only after the coordinator grants the graphics slot and after the selected branch has been built.

The workflow creates `Dungeons/NavigationQA/Karte.dungeon` **only in the isolated QA vault**, places and saves one visible marker, and then records camera, document, notes, dirty state, history and screenshots. It checks Space+left and middle-button drags of `+96,+64` screen pixels at 64 and 80 screen pixels per field, equivalent to the native 100 % and 125 % views. A zoomed-in map must move its world center by `(-1.5,-1)` fields at 100 % and `(-1.2,-0.8)` at 125 %. It then sends one Control+wheel event with `deltaY=-100` at 100 % and `deltaY=+100` at 125 %, and checks the native target zoom scales 80 and 64 while preserving the world point under the pointer.

The current `src/navigation.ts` computes `Math.exp(±48 × 0.006)` for these wheel events. It therefore predicts about `85.36`, not 80, on zoom-in and about `59.98`, not 64, on zoom-out. The workflow saves `dd041-navigation-result.json` before failing the host gate, so the deviation remains reviewable. The measured browser wheel event is stored with each case. A Playwright `100`-pixel wheel event is a controlled browser input; comparison with a physical Linux wheel detent is a remaining input-mapping check.

DD-041.01 has no permanent Hand tool in the observed Dungeondraft toolbar. The editor's Hand button is an additional convenience control and is deliberately not counted as a native requirement by this workflow.

To bring the workflow into a newer test harness that changed concurrently, carry over the new module and wrapper and add the small `--dd041-navigation` dispatch from this branch's `tools/host-test.cjs`. Keep the newer harness's other modes and its QA environment settings.
