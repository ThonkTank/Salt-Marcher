// linkedom has no constraint validation. Only emulate custom errors here;
// Chromium remains the authority for disabled controls and number-input validity.
export function mockCustomValidity(window) {
  const proto = window.HTMLInputElement.prototype,
    keys = ['setCustomValidity', 'validity'],
    previous = keys.map((k) => Object.getOwnPropertyDescriptor(proto, k)),
    errors = new WeakMap();
  Object.defineProperties(proto, {
    setCustomValidity: {
      configurable: true,
      value(message) {
        errors.set(this, String(message));
      },
    },
    validity: {
      configurable: true,
      get() {
        return { valid: !errors.get(this), customError: !!errors.get(this) };
      },
    },
  });
  return () =>
    keys.forEach((key, i) =>
      previous[i] ? Object.defineProperty(proto, key, previous[i]) : delete proto[key],
    );
}
