import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Atlas, emptyAtlas, validate } from "./model";
type Intent = "new" | "open" | "close";
export function useFiles(
  document: Atlas,
  onLoad: (a: Atlas) => void,
  onError: (error: string) => void,
) {
  const [saved, setSaved] = useState(document),
    [name, setName] = useState("Unbenannter Atlas"),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<Intent | null>(null);
  const locked = useRef(false),
    closing = useRef(false),
    dirty = document !== saved;
  const latest = useRef({ dirty, request });
  latest.current = { dirty, request };
  const error = (e: unknown) =>
    onError(e instanceof Error ? e.message : String(e));
  function native() {
    if (!isTauri())
      throw Error(
        "Dateien öffnen und speichern ist in der Desktop-App verfügbar.",
      );
  }
  async function save(as = false): Promise<boolean> {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    try {
      native();
      const name = await invoke<string | null>("save_atlas", {
        document,
        saveAs: as,
      });
      if (!name) return false;
      setName(name);
      setSaved(document);
      return true;
    } catch (e) {
      error(e);
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function execute(intent: Intent) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      if (intent === "new") {
        if (isTauri()) await invoke("new_atlas");
        const a = emptyAtlas();
        onLoad(a);
        setSaved(a);
        setName("Unbenannter Atlas");
      }
      if (intent === "open") {
        native();
        const result = await invoke<{ document: Atlas; name: string } | null>(
          "open_atlas",
        );
        if (result) {
          validate(result.document);
          onLoad(result.document);
          setSaved(result.document);
          setName(result.name);
        }
      }
      if (intent === "close") {
        closing.current = true;
        await getCurrentWindow().destroy();
      }
    } catch (e) {
      closing.current = false;
      error(e);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function request(intent: Intent) {
    if (locked.current) return;
    if (dirty) setPending(intent);
    else void execute(intent);
  }
  async function resolve(choice: "save" | "discard" | "cancel") {
    const intent = pending;
    if (!intent || locked.current) return;
    if (choice === "cancel") {
      setPending(null);
      return;
    }
    if (choice === "save" && !(await save())) return;
    setPending(null);
    await execute(intent);
  }
  useEffect(() => {
    window.document.title = `${dirty ? "● " : ""}${name} · SaltMarcher`;
  }, [dirty, name]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (latest.current.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    let dispose: (() => void) | undefined,
      cancelled = false;
    if (isTauri())
      void getCurrentWindow()
        .onCloseRequested((e) => {
          if (closing.current) return;
          e.preventDefault();
          latest.current.request("close");
        })
        .then((fn) => {
          if (cancelled) fn();
          else dispose = fn;
        })
        .catch(error);
    return () => {
      cancelled = true;
      dispose?.();
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
  return { name, dirty, busy, pending, save, request, resolve };
}
