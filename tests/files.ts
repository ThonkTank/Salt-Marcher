import { Page } from "@playwright/test";
import { Atlas } from "../src/model";
// Browser-only substitute for native dialogs. Production code uses Tauri directly.
export async function files(page: Page, document?: Atlas) {
  await page.evaluate((doc) => {
    const w = window as any;
    w.isTauri = true;
    w.__saved = [];
    w.__saveResult = "Test.saltatlas.json";
    w.__openResult = doc
      ? { document: doc, name: "Test.saltatlas.json" }
      : null;
    w.__newCount = 0;
    w.__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args: any) => {
        if (cmd === "save_atlas") {
          if (w.__saveError) throw w.__saveError;
          w.__saved.push(args);
          return w.__saveResult;
        }
        if (cmd === "open_atlas") return w.__openResult;
        if (cmd === "new_atlas") {
          w.__newCount++;
          return null;
        }
        return null;
      },
    };
  }, document);
}
