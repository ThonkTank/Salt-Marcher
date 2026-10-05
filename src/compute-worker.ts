import { compute, type ComputeRequest } from "./compute";
const worker = globalThis as unknown as {
  onmessage: (
    event: MessageEvent<{ id: number; request: ComputeRequest }>,
  ) => void;
  postMessage: (value: unknown) => void;
};
worker.onmessage = (event) => {
  const { id, request } = event.data;
  try {
    worker.postMessage({ id, result: compute(request) });
  } catch (error) {
    worker.postMessage({ id, error: String(error) });
  }
};
