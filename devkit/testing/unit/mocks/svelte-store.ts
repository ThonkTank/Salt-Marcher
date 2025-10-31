// devkit/testing/unit/mocks/svelte-store.ts
// Mock implementation of svelte/store for testing purposes

type Subscriber<T> = (value: T) => void;
type Unsubscriber = () => void;

export interface Readable<T> {
	subscribe(subscriber: Subscriber<T>): Unsubscriber;
}

export interface Writable<T> extends Readable<T> {
	set(value: T): void;
	update(updater: (value: T) => T): void;
}

/**
 * Creates a writable store
 */
export function writable<T>(initialValue: T): Writable<T> {
	let value = initialValue;
	const subscribers = new Set<Subscriber<T>>();

	return {
		subscribe(subscriber: Subscriber<T>): Unsubscriber {
			subscribers.add(subscriber);
			subscriber(value); // Call immediately with current value
			return () => {
				subscribers.delete(subscriber);
			};
		},
		set(newValue: T): void {
			value = newValue;
			subscribers.forEach((sub) => sub(value));
		},
		update(updater: (value: T) => T): void {
			value = updater(value);
			subscribers.forEach((sub) => sub(value));
		},
	};
}

/**
 * Creates a derived store
 */
export function derived<T, S>(
	stores: Readable<S> | Readable<S>[],
	fn: (values: S | S[]) => T,
	initialValue?: T
): Readable<T> {
	const storeArray = Array.isArray(stores) ? stores : [stores];
	const subscribers = new Set<Subscriber<T>>();
	let value = initialValue as T;
	let isInitialized = false;

	// Lazy subscription - only subscribe when first subscriber arrives
	let unsubscribers: Unsubscriber[] = [];
	const values: S[] = [];

	function startSubscriptions(): void {
		if (unsubscribers.length > 0) return; // Already subscribed

		storeArray.forEach((store, index) => {
			const unsub = store.subscribe((v) => {
				values[index] = v;
				value = fn(Array.isArray(stores) ? values : values[0]);
				isInitialized = true;
				subscribers.forEach((sub) => sub(value));
			});
			unsubscribers.push(unsub);
		});
	}

	function stopSubscriptions(): void {
		unsubscribers.forEach((unsub) => unsub());
		unsubscribers = [];
	}

	return {
		subscribe(subscriber: Subscriber<T>): Unsubscriber {
			const isFirstSubscriber = subscribers.size === 0;

			subscribers.add(subscriber);

			if (isFirstSubscriber) {
				startSubscriptions();
			}

			// Call with current value if available
			if (isInitialized) {
				subscriber(value);
			}

			return () => {
				subscribers.delete(subscriber);
				// Clean up source subscriptions if no more subscribers
				if (subscribers.size === 0) {
					stopSubscriptions();
					isInitialized = false;
				}
			};
		},
	};
}

/**
 * Gets the current value from a readable store
 */
export function get<T>(store: Readable<T>): T {
	let value: T;
	const unsubscribe = store.subscribe((v) => {
		value = v;
	});
	unsubscribe();
	return value!;
}

/**
 * Creates a readable store
 */
export function readable<T>(
	initialValue: T,
	start?: (set: (value: T) => void) => Unsubscriber | void
): Readable<T> {
	const { subscribe, set } = writable(initialValue);

	return {
		subscribe(subscriber: Subscriber<T>): Unsubscriber {
			const unsubscribe = subscribe(subscriber);
			const stop = start?.(set);
			return () => {
				unsubscribe();
				stop?.();
			};
		},
	};
}
