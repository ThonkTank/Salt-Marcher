import { describe, it, expect } from 'vitest';
import {
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  map,
  mapErr,
  flatMap,
  type Result,
} from './result';

describe('Result', () => {
  describe('constructors', () => {
    it('ok creates success Result', () => {
      const result = ok(42);
      expect(result).toEqual({ ok: true, value: 42 });
    });

    it('err creates failure Result', () => {
      const result = err('error message');
      expect(result).toEqual({ ok: false, error: 'error message' });
    });
  });

  describe('type guards', () => {
    it('isOk returns true for Ok', () => {
      expect(isOk(ok(42))).toBe(true);
      expect(isOk(err('error'))).toBe(false);
    });

    it('isErr returns true for Err', () => {
      expect(isErr(err('error'))).toBe(true);
      expect(isErr(ok(42))).toBe(false);
    });

    it('type narrowing works with isOk', () => {
      const result: Result<number, string> = ok(42);
      if (isOk(result)) {
        // TypeScript knows result.value exists here
        expect(result.value).toBe(42);
      }
    });

    it('type narrowing works with isErr', () => {
      const result: Result<number, string> = err('failed');
      if (isErr(result)) {
        // TypeScript knows result.error exists here
        expect(result.error).toBe('failed');
      }
    });
  });

  describe('unwrap', () => {
    it('extracts value from Ok', () => {
      expect(unwrap(ok(42))).toBe(42);
    });

    it('throws on Err', () => {
      expect(() => unwrap(err('error'))).toThrow('Called unwrap on Err');
    });
  });

  describe('unwrapOr', () => {
    it('returns value for Ok', () => {
      expect(unwrapOr(ok(42), 0)).toBe(42);
    });

    it('returns default for Err', () => {
      expect(unwrapOr(err('error'), 0)).toBe(0);
    });
  });

  describe('map', () => {
    it('transforms Ok value', () => {
      const result = map(ok(2), (x) => x * 2);
      expect(result).toEqual(ok(4));
    });

    it('passes through Err unchanged', () => {
      const result = map(err('error') as Result<number, string>, (x) => x * 2);
      expect(result).toEqual(err('error'));
    });
  });

  describe('mapErr', () => {
    it('transforms Err value', () => {
      const result = mapErr(err('error'), (e) => e.toUpperCase());
      expect(result).toEqual(err('ERROR'));
    });

    it('passes through Ok unchanged', () => {
      const result = mapErr(ok(42) as Result<number, string>, (e) =>
        e.toUpperCase()
      );
      expect(result).toEqual(ok(42));
    });
  });

  describe('flatMap', () => {
    it('chains Ok results', () => {
      const divide = (a: number, b: number): Result<number, string> =>
        b === 0 ? err('division by zero') : ok(a / b);

      const result = flatMap(ok(10), (x) => divide(x, 2));
      expect(result).toEqual(ok(5));
    });

    it('short-circuits on Err', () => {
      const divide = (a: number, b: number): Result<number, string> =>
        b === 0 ? err('division by zero') : ok(a / b);

      const result = flatMap(err('initial error') as Result<number, string>, (x) =>
        divide(x, 2)
      );
      expect(result).toEqual(err('initial error'));
    });

    it('propagates Err from inner function', () => {
      const divide = (a: number, b: number): Result<number, string> =>
        b === 0 ? err('division by zero') : ok(a / b);

      const result = flatMap(ok(10), (x) => divide(x, 0));
      expect(result).toEqual(err('division by zero'));
    });
  });
});
