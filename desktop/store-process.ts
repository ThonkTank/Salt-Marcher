import { ProjectStore } from "./project-store";
import type {
  CommitRequest,
  ReadRegionRequest,
  ReadPresentationRequest,
  SourceBoundary,
} from "../src/editor/bridge";

interface ParentMessage {
  id: number;
  method: string;
  argument?: unknown;
}

const port = process.parentPort;
if (!port)
  throw new Error(
    "Der Projektspeicher benötigt einen Electron-Utility-Prozess.",
  );

let store: ProjectStore;
try {
  const directory = process.argv[2];
  if (!directory) throw new Error("Arbeitsverzeichnis fehlt.");
  store = new ProjectStore(
    directory,
    process.env.ATLAS_P0_DIAGNOSTICS === "1"
      ? (activity) => port.postMessage({ activity })
      : undefined,
  );
} catch (error) {
  port.postMessage({
    fatal: error instanceof Error ? error.message : String(error),
  });
  throw error;
}

async function dispatch({ method, argument }: ParentMessage) {
  switch (method) {
    case "status":
      return store.status();
    case "metrics":
      return store.metrics();
    case "readRegion":
      return store.readRegion(argument as ReadRegionRequest);
    case "readPresentation":
      return store.readPresentation(argument as ReadPresentationRequest);
    case "commit":
      return store.commit(argument as CommitRequest);
    case "newProject":
      return store.newProject(argument as SourceBoundary | undefined);
    case "openProject": {
      const input = argument as { path: string; expected?: SourceBoundary };
      return store.openProject(input.path, input.expected);
    }
    case "prepareSave":
      return store.prepareSave(argument as SourceBoundary);
    case "publishSave": {
      const input = argument as { token: string; path: string };
      return store.publishSave(input.token, input.path);
    }
    case "discardSave":
      return store.discardSave((argument as { token: string }).token);
    case "close":
      store.close(argument as SourceBoundary | undefined);
      return null;
    default:
      throw new Error("Unbekannte Speicheroperation.");
  }
}

const reply = async (data: ParentMessage): Promise<void> => {
  try {
    const value = await dispatch(data);
    port.postMessage({ id: data.id, value });
  } catch (error) {
    port.postMessage({
      id: data.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// Mutations, save phases and project lifecycle stay ordered. Both local reads
// are synchronous on this same SQLite owner: they cannot interrupt a transaction,
// but may answer while a snapshot or file publication yields to the event loop.
let queue = Promise.resolve();
port.on("message", ({ data }: { data: ParentMessage }) => {
  if (!data || !Number.isSafeInteger(data.id) || data.id <= 0) return;
  if (data.method === "readRegion" || data.method === "readPresentation") {
    void reply(data);
  } else {
    queue = queue.then(() => reply(data));
  }
});

process.on("SIGTERM", () => {
  store.close();
  process.exit(0);
});

port.postMessage({ ready: true });
