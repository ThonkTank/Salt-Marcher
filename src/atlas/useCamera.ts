import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  toWorld,
  type EditorContext,
  type Scene,
  type Bounds,
  type Camera,
  type House,
  type Status,
} from "./model";
import type { AtlasClient } from "./client";
import { contextKey, polygonBounds } from "./parcelEditor";
import { scheduledRead } from "./readScheduler";
import { sameVersion } from "./documentVersion";

/** Navigation owns only the latest asynchronous Fit; rendering has no protocol. */
export function useCamera({
  status,
  context,
  floor,
  setCameraState,
}: {
  status: Status | null;
  context: EditorContext;
  floor: number;
  setCameraState: Dispatch<SetStateAction<Camera>>;
}) {
  const serial = useRef(0),
    latestVersion = useRef(status);
  const [pending, setPending] = useState(false);
  latestVersion.current = status;
  const cancelFit = useCallback(() => {
    serial.current++;
    setPending(false);
  }, []);
  useEffect(() => {
    cancelFit();
    return () => {
      serial.current++;
    };
  }, [
    contextKey(context),
    floor,
    status?.sessionId,
    status?.revision,
    cancelFit,
  ]);
  const setCamera = useCallback(
    (next: SetStateAction<Camera>) => {
      cancelFit();
      setCameraState(next);
    },
    [cancelFit, setCameraState],
  );
  const fit = async (
    client: AtlasClient,
    scene: Scene | undefined,
    size: { width: number; height: number },
  ) => {
    const request = ++serial.current,
      version = latestVersion.current;
    if (!version) return;
    const current = () =>
      request === serial.current && sameVersion(latestVersion.current, version);
    setPending(true);
    try {
      let b: Bounds | null = null;
      let headers = scene;
      if (
        context.kind !== "exterior" &&
        !sameVersion(headers?.status, version)
      ) {
        headers = await scheduledRead(client, "scene", {
          bounds: [0, 0, 0, 0],
          context,
        });
        if (!headers || !sameVersion(headers.status, version))
          throw Error(
            "Dokumentstand hat sich während des Einpassens geändert. Bitte erneut einpassen.",
          );
      }
      const house = headers?.objects.find(
        (o): o is House =>
          o.kind === "house" && o.id === headers?.contextState.houseId,
      );
      const parcel = headers?.objects.find(
        (o) => o.kind === "parcel" && o.id === headers?.contextState.parcelId,
      );
      if (context.kind === "parcel") {
        b = parcel?.kind === "parcel" ? polygonBounds(parcel.polygon) : null;
      } else if (context.kind === "house" && house) {
        const points = house.contours
          .flat()
          .map((p) => toWorld(p, house.transform));
        b = polygonBounds(points);
      } else b = await client.request("extent", {});
      if (!current() || !b) return;
      const scale = Math.max(
        context.kind === "house" ? 1.28 : 0.000064,
        Math.min(
          25.6,
          (size.width - 100) / Math.max(1, b[2] - b[0]),
          (size.height - 100) / Math.max(1, b[3] - b[1]),
        ),
      );
      setCameraState({
        scale,
        x: size.width / 2 - ((b[0] + b[2]) / 2) * scale,
        y: size.height / 2 - ((b[1] + b[3]) / 2) * scale,
      });
    } catch (error) {
      if (current()) throw error;
    } finally {
      if (current()) setPending(false);
    }
  };
  return { cancelFit, setCamera, fit, pending };
}
