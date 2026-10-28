/** Register listeners with the surface that owns them, preserving native event types. */
export function ownedEventTarget<T extends EventTarget>(
  target: T,
  cleanups: (() => void)[],
): Pick<T, 'addEventListener'> {
  return {
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) {
      target.addEventListener(type, listener, options);
      cleanups.push(() => target.removeEventListener(type, listener, options));
    },
  } as Pick<T, 'addEventListener'>;
}
