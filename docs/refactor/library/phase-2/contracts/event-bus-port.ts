export interface EventEnvelope<Payload = unknown> {
  type: string;
  payload: Payload;
  version: number;
  source: 'renderer' | 'service' | 'storage' | 'watcher';
  timestamp: number;
}

export type EventUnsubscribe = () => void;

export interface EventBusPort {
  publish<Payload>(event: EventEnvelope<Payload>): Promise<void>;
  subscribe<Payload>(type: string, handler: (event: EventEnvelope<Payload>) => Promise<void> | void): EventUnsubscribe;
  once<Payload>(type: string, handler: (event: EventEnvelope<Payload>) => Promise<void> | void): Promise<void>;
  drain(): Promise<void>;
}

