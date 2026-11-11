import { net } from "electron";
import { Readable } from "node:stream";
import type { UpdateFetch } from "./updates";

function headersFrom(values: Record<string, string | string[]>): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value])
      headers.append(name, item);
  }
  return headers;
}

/**
 * Electron 44 net.fetch rejects manual redirects. Expose each redirect as a
 * Response instead, so fetchPreviewAsset remains the single URL-policy owner.
 * Chromium still supplies system proxy/certificate support; bodies keep bounded
 * Node/Web stream backpressure instead of buffering a whole installer in RAM.
 */
export const fetchElectronUpdate: UpdateFetch = (url, init) => {
  if (init.method && init.method !== "GET")
    return Promise.reject(new Error("Update-Downloads benötigen GET."));
  if (init.signal?.aborted) return Promise.reject(init.signal.reason);
  return new Promise<Response>((resolve, reject) => {
    const request = net.request({
      url,
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      credentials: "omit",
      bypassCustomProtocolHandlers: true,
    });
    let settled = false;
    let incoming: Readable | null = null;
    const cleanup = () => init.signal?.removeEventListener("abort", abort);
    const fail = (error: Error) => {
      cleanup();
      if (incoming && !incoming.destroyed) incoming.destroy(error);
      if (!settled) {
        settled = true;
        reject(error);
      }
    };
    const abort = () => {
      fail(
        init.signal?.reason instanceof Error
          ? init.signal.reason
          : new Error("Der Update-Download wurde abgebrochen."),
      );
      request.abort();
    };
    request.on("error", fail);
    request.once("abort", () =>
      fail(new Error("Der Update-Download wurde abgebrochen.")),
    );
    request.once("redirect", (status, _method, destination, values) => {
      try {
        const headers = headersFrom(values);
        headers.set("location", destination);
        const response = new Response(null, { status, headers });
        settled = true;
        resolve(response);
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      } finally {
        // No automatic redirect: the caller validates destination before a new GET.
        cleanup();
        request.abort();
      }
    });
    request.once("response", (response) => {
      try {
        // Electron documents a Node Readable here, but its generated types omit
        // the inherited stream methods. Check the runtime contract explicitly.
        if (!(response instanceof Readable))
          throw new Error(
            "Der Paketdownload liefert keinen lesbaren Datenstrom.",
          );
        incoming = response;
        response.on("error", fail);
        response.once("aborted", () =>
          fail(new Error("Der Paketdownload wurde vorzeitig abgebrochen.")),
        );
        response.once("end", cleanup);
        response.once("close", () => {
          cleanup();
          if (!response.readableEnded) request.abort();
        });
        const body = [204, 205, 304].includes(response.statusCode)
          ? null
          : (Readable.toWeb(response, {
              strategy: {
                highWaterMark: 64 * 1024,
                size: (chunk: Uint8Array) => chunk.byteLength,
              },
            }) as ReadableStream<Uint8Array>);
        const result = new Response(body, {
          status: response.statusCode,
          statusText: response.statusMessage,
          headers: headersFrom(response.headers),
        });
        settled = true;
        resolve(result);
        if (!body) response.resume();
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
        request.abort();
      }
    });
    init.signal?.addEventListener("abort", abort, { once: true });
    if (init.signal?.aborted) abort();
    else request.end();
  });
};
