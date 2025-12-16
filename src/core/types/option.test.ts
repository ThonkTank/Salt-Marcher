import { describe, it, expect } from 'vitest';
import {
  some,
  none,
  fromNullable,
  isSome,
  isNone,
  getOrElse,
  unwrap,
  map,
  flatMap,
  filter,
  type Option,
} from './option';

describe('Option', () => {
  describe('constructors', () => {
    it('some creates Some Option', () => {
      const option = some(42);
      expect(option).toEqual({ some: true, value: 42 });
    });

    it('none creates None Option', () => {
      const option = none();
      expect(option).toEqual({ none: true });
    });
  });

  describe('fromNullable', () => {
    it('creates Some for non-null values', () => {
      expect(fromNullable(42)).toEqual(some(42));
      expect(fromNullable('hello')).toEqual(some('hello'));
      expect(fromNullable(0)).toEqual(some(0));
      expect(fromNullable('')).toEqual(some(''));
      expect(fromNullable(false)).toEqual(some(false));
    });

    it('creates None for null', () => {
      expect(fromNullable(null)).toEqual(none());
    });

    it('creates None for undefined', () => {
      expect(fromNullable(undefined)).toEqual(none());
    });
  });

  describe('type guards', () => {
    it('isSome returns true for Some', () => {
      expect(isSome(some(42))).toBe(true);
      expect(isSome(none())).toBe(false);
    });

    it('isNone returns true for None', () => {
      expect(isNone(none())).toBe(true);
      expect(isNone(some(42))).toBe(false);
    });

    it('type narrowing works with isSome', () => {
      const option: Option<number> = some(42);
      if (isSome(option)) {
        expect(option.value).toBe(42);
      }
    });

    it('type narrowing works with isNone', () => {
      const option: Option<number> = none();
      if (isNone(option)) {
        expect(option.none).toBe(true);
      }
    });
  });

  describe('getOrElse', () => {
    it('returns value for Some', () => {
      expect(getOrElse(some(42), 0)).toBe(42);
    });

    it('returns default for None', () => {
      expect(getOrElse(none(), 0)).toBe(0);
    });
  });

  describe('unwrap', () => {
    it('extracts value from Some', () => {
      expect(unwrap(some(42))).toBe(42);
    });

    it('throws on None', () => {
      expect(() => unwrap(none())).toThrow('Called unwrap on None');
    });
  });

  describe('map', () => {
    it('transforms Some value', () => {
      const option = map(some(2), (x) => x * 2);
      expect(option).toEqual(some(4));
    });

    it('passes through None unchanged', () => {
      const option = map(none() as Option<number>, (x) => x * 2);
      expect(isNone(option)).toBe(true);
    });
  });

  describe('flatMap', () => {
    it('chains Some options', () => {
      const safeDivide = (a: number, b: number): Option<number> =>
        b === 0 ? none() : some(a / b);

      const option = flatMap(some(10), (x) => safeDivide(x, 2));
      expect(option).toEqual(some(5));
    });

    it('short-circuits on None', () => {
      const safeDivide = (a: number, b: number): Option<number> =>
        b === 0 ? none() : some(a / b);

      const option = flatMap(none() as Option<number>, (x) => safeDivide(x, 2));
      expect(isNone(option)).toBe(true);
    });

    it('propagates None from inner function', () => {
      const safeDivide = (a: number, b: number): Option<number> =>
        b === 0 ? none() : some(a / b);

      const option = flatMap(some(10), (x) => safeDivide(x, 0));
      expect(isNone(option)).toBe(true);
    });
  });

  describe('filter', () => {
    it('keeps Some if predicate is true', () => {
      const option = filter(some(10), (x) => x > 5);
      expect(option).toEqual(some(10));
    });

    it('returns None if predicate is false', () => {
      const option = filter(some(3), (x) => x > 5);
      expect(isNone(option)).toBe(true);
    });

    it('passes through None unchanged', () => {
      const option = filter(none() as Option<number>, (x) => x > 5);
      expect(isNone(option)).toBe(true);
    });
  });
});
