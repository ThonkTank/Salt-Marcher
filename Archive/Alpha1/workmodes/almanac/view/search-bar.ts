/**
 * Almanac Search Bar Component
 *
 * Provides text-based search UI with debouncing and keyboard shortcuts:
 * - Search input with 300ms debounce
 * - Result counter ("3 of 5 results")
 * - Previous/Next navigation buttons
 * - Keyboard shortcuts: Ctrl+F focus, ↑/↓ navigate, Enter next, Escape clear
 *
 * Part of Phase 13 Priority 6 - Search Functionality
 */

export interface SearchBarConfig {
	/**
	 * Debounce delay in milliseconds (default: 300ms)
	 */
	readonly debounceMs?: number;

	/**
	 * Placeholder text for search input
	 */
	readonly placeholder?: string;

	/**
	 * Whether to show result counter
	 */
	readonly showCounter?: boolean;
}

export interface SearchBarHandle {
	/**
	 * Updates the result counter
	 */
	updateCounter(currentIndex: number, totalResults: number): void;

	/**
	 * Clears the search input and counter
	 */
	clear(): void;

	/**
	 * Focuses the search input
	 */
	focus(): void;

	/**
	 * Gets the current search query
	 */
	getQuery(): string;

	/**
	 * Destroys the search bar and removes event listeners
	 */
	destroy(): void;
}

export interface SearchBarCallbacks {
	/**
	 * Called when search query changes (after debounce)
	 */
	onSearch: (query: string) => void;

	/**
	 * Called when user navigates to next result
	 */
	onNext?: () => void;

	/**
	 * Called when user navigates to previous result
	 */
	onPrevious?: () => void;

	/**
	 * Called when search is cleared
	 */
	onClear?: () => void;
}

/**
 * Creates a search bar component
 *
 * @param container - Parent element to render into
 * @param callbacks - Event callbacks
 * @param config - Configuration options
 * @returns Handle for controlling the search bar
 */
export function createSearchBar(
	container: HTMLElement,
	callbacks: SearchBarCallbacks,
	config: SearchBarConfig = {}
): SearchBarHandle {
	const {
		debounceMs = 300,
		placeholder = 'Search events...',
		showCounter = true,
	} = config;

	// Create search bar container
	const searchBar = container.createDiv({ cls: 'sm-search-bar' });

	// Create input group (input + clear button)
	const inputGroup = searchBar.createDiv({ cls: 'sm-search-input-group' });

	// Create search input
	const searchInput = inputGroup.createEl('input', {
		cls: 'sm-search-input',
		attr: {
			type: 'text',
			placeholder,
			'aria-label': 'Search events',
		},
	});

	// Create clear button (hidden by default)
	const clearButton = inputGroup.createEl('button', {
		cls: 'sm-search-clear-btn',
		attr: {
			'aria-label': 'Clear search',
			title: 'Clear search (Esc)',
		},
	});
	clearButton.innerHTML = '×'; // Unicode multiplication sign
	clearButton.style.display = 'none';

	// Create result counter
	let counterElement: HTMLElement | null = null;
	if (showCounter) {
		counterElement = searchBar.createDiv({ cls: 'sm-search-counter' });
		counterElement.style.display = 'none';
	}

	// Create navigation buttons
	const navGroup = searchBar.createDiv({ cls: 'sm-search-nav' });

	const prevButton = navGroup.createEl('button', {
		cls: 'sm-search-nav-btn sm-search-nav-prev',
		attr: {
			'aria-label': 'Previous result',
			title: 'Previous result (↑)',
		},
	});
	prevButton.innerHTML = '↑';
	prevButton.disabled = true;

	const nextButton = navGroup.createEl('button', {
		cls: 'sm-search-nav-btn sm-search-nav-next',
		attr: {
			'aria-label': 'Next result',
			title: 'Next result (↓ or Enter)',
		},
	});
	nextButton.innerHTML = '↓';
	nextButton.disabled = true;

	// Debounce timer
	let debounceTimer: number | null = null;

	// Handle input changes
	function handleInputChange(): void {
		const query = searchInput.value.trim();

		// Show/hide clear button
		clearButton.style.display = query ? 'block' : 'none';

		// Debounce search callback
		if (debounceTimer !== null) {
			window.clearTimeout(debounceTimer);
		}

		debounceTimer = window.setTimeout(() => {
			callbacks.onSearch(query);
			debounceTimer = null;
		}, debounceMs);
	}

	// Handle clear button click
	function handleClear(): void {
		searchInput.value = '';
		clearButton.style.display = 'none';
		if (counterElement) {
			counterElement.style.display = 'none';
		}
		prevButton.disabled = true;
		nextButton.disabled = true;

		// Cancel pending debounce
		if (debounceTimer !== null) {
			window.clearTimeout(debounceTimer);
			debounceTimer = null;
		}

		callbacks.onClear?.();
		callbacks.onSearch('');
	}

	// Handle navigation buttons
	function handlePrevious(): void {
		callbacks.onPrevious?.();
	}

	function handleNext(): void {
		callbacks.onNext?.();
	}

	// Keyboard shortcuts
	function handleKeyDown(event: KeyboardEvent): void {
		// Escape: Clear search
		if (event.key === 'Escape') {
			event.preventDefault();
			handleClear();
			searchInput.blur();
			return;
		}

		// Enter or ArrowDown: Next result
		if (event.key === 'Enter' || event.key === 'ArrowDown') {
			if (!nextButton.disabled) {
				event.preventDefault();
				handleNext();
			}
			return;
		}

		// ArrowUp: Previous result
		if (event.key === 'ArrowUp') {
			if (!prevButton.disabled) {
				event.preventDefault();
				handlePrevious();
			}
			return;
		}
	}

	// Global keyboard shortcut: Ctrl+F to focus search
	function handleGlobalKeyDown(event: KeyboardEvent): void {
		if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
			// Only prevent default if search bar is visible
			if (searchBar.offsetParent !== null) {
				event.preventDefault();
				searchInput.focus();
			}
		}
	}

	// Attach event listeners
	searchInput.addEventListener('input', handleInputChange);
	clearButton.addEventListener('click', handleClear);
	prevButton.addEventListener('click', handlePrevious);
	nextButton.addEventListener('click', handleNext);
	searchInput.addEventListener('keydown', handleKeyDown);
	document.addEventListener('keydown', handleGlobalKeyDown);

	// Public API
	const handle: SearchBarHandle = {
		updateCounter(currentIndex: number, totalResults: number): void {
			if (!counterElement) return;

			if (totalResults === 0) {
				counterElement.textContent = 'No results';
				counterElement.style.display = 'block';
				prevButton.disabled = true;
				nextButton.disabled = true;
			} else {
				counterElement.textContent = `${currentIndex + 1} of ${totalResults}`;
				counterElement.style.display = 'block';
				prevButton.disabled = currentIndex === 0;
				nextButton.disabled = currentIndex === totalResults - 1;
			}
		},

		clear(): void {
			handleClear();
		},

		focus(): void {
			searchInput.focus();
		},

		getQuery(): string {
			return searchInput.value.trim();
		},

		destroy(): void {
			// Remove event listeners
			searchInput.removeEventListener('input', handleInputChange);
			clearButton.removeEventListener('click', handleClear);
			prevButton.removeEventListener('click', handlePrevious);
			nextButton.removeEventListener('click', handleNext);
			searchInput.removeEventListener('keydown', handleKeyDown);
			document.removeEventListener('keydown', handleGlobalKeyDown);

			// Cancel pending debounce
			if (debounceTimer !== null) {
				window.clearTimeout(debounceTimer);
			}

			// Remove DOM elements
			searchBar.remove();
		},
	};

	return handle;
}
