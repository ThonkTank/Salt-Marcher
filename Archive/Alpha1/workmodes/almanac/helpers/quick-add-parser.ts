// src/workmodes/almanac/helpers/quick-add-parser.ts
// Smart parser for quick-add event creation


export type EventCategory = 'encounter' | 'session' | 'faction' | 'weather' | 'festival' | 'ritual' | 'travel';
export type EventPriority = 'urgent' | 'high' | 'normal' | 'low';

export interface QuickAddParseResult {
    title: string;
    date?: Date;
    time?: { hour: number; minute: number };
    category?: EventCategory;
    priority?: EventPriority;
    tags?: string[];
    isAllDay?: boolean;
    parseErrors?: string[];
}

/**
 * Quick-Add Parser
 *
 * Parses natural language input for event creation:
 * - Dates: "tomorrow", "in 3 days", "2025-01-15"
 * - Times: "2pm", "14:30", "2:30pm"
 * - Categories: "#encounter", "#session", etc.
 * - Priorities: "!urgent", "!high", "!normal", "!low"
 * - Tags: "@combat", "@dragon"
 *
 * Example: "Dragon attack tomorrow 2pm #encounter !high @combat @dragon"
 * Results in: { title: "Dragon attack", date: tomorrow, time: 14:00, category: "encounter", priority: "high", tags: ["combat", "dragon"] }
 */
export class QuickAddParser {
    constructor(private currentTimestamp: Date) {}

    parse(input: string): QuickAddParseResult {
        let remaining = input.trim();
        const result: QuickAddParseResult = {
            title: '',
            tags: []
        };

        // Extract category (#encounter, #faction, etc.)
        const categoryMatch = remaining.match(/#(\w+)/);
        if (categoryMatch) {
            result.category = this.parseCategory(categoryMatch[1]);
            remaining = remaining.replace(categoryMatch[0], '').trim();
        }

        // Extract priority (!urgent, !high, !normal, !low) - match any word after !
        const priorityMatch = remaining.match(/!(\w+)/i);
        if (priorityMatch) {
            result.priority = this.parsePriority(priorityMatch[1]);
            remaining = remaining.replace(priorityMatch[0], '').trim();
        }

        // Extract tags (@tag1 @tag2) - using exec instead of matchAll for TypeScript compatibility
        const tagRegex = /@(\w+)/g;
        let tagMatch;
        const tagsToRemove: string[] = [];
        while ((tagMatch = tagRegex.exec(remaining)) !== null) {
            result.tags!.push(tagMatch[1]);
            tagsToRemove.push(tagMatch[0]);
        }
        // Remove all tags from remaining text
        for (const tag of tagsToRemove) {
            remaining = remaining.replace(tag, '').trim();
        }

        // Extract date (tomorrow, next week, in 3 days, 2025-01-15)
        const dateResult = this.parseDate(remaining);
        if (dateResult) {
            result.date = dateResult.date;
            remaining = dateResult.remaining;
        }

        // Extract time (2pm, 14:00, 2:30pm)
        const timeResult = this.parseTime(remaining);
        if (timeResult) {
            result.time = timeResult.time;
            result.isAllDay = false;
            remaining = timeResult.remaining;
        } else {
            result.isAllDay = true;
        }

        // Remaining text is the title
        result.title = remaining.trim();

        if (!result.title) {
            result.parseErrors = ['Title is required'];
        }

        return result;
    }

    private parseCategory(str: string): EventCategory | undefined {
        const normalized = str.toLowerCase();
        const map: Record<string, EventCategory> = {
            'encounter': 'encounter',
            'session': 'session',
            'faction': 'faction',
            'weather': 'weather',
            'festival': 'festival',
            'ritual': 'ritual',
            'travel': 'travel'
        };
        return map[normalized];
    }

    private parsePriority(str: string): EventPriority {
        const normalized = str.toLowerCase();
        const map: Record<string, EventPriority> = {
            'urgent': 'urgent',
            'high': 'high',
            'normal': 'normal',
            'low': 'low'
        };
        return map[normalized] || 'normal';
    }

    private parseDate(input: string): { date: Date; remaining: string } | null {
        // Try relative dates first
        const today = new Date(this.currentTimestamp);

        // "tomorrow"
        if (input.match(/\btomorrow\b/i)) {
            const date = new Date(today);
            date.setDate(date.getDate() + 1);
            return {
                date,
                remaining: input.replace(/\btomorrow\b/i, '').trim()
            };
        }

        // "in X days"
        const inDaysMatch = input.match(/\bin\s+(\d+)\s+days?\b/i);
        if (inDaysMatch) {
            const days = parseInt(inDaysMatch[1]);
            const date = new Date(today);
            date.setDate(date.getDate() + days);
            return {
                date,
                remaining: input.replace(inDaysMatch[0], '').trim()
            };
        }

        // "next week" (7 days from now)
        if (input.match(/\bnext\s+week\b/i)) {
            const date = new Date(today);
            date.setDate(date.getDate() + 7);
            return {
                date,
                remaining: input.replace(/\bnext\s+week\b/i, '').trim()
            };
        }

        // ISO format: 2025-01-15
        const isoMatch = input.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            const date = new Date(
                parseInt(isoMatch[1]),
                parseInt(isoMatch[2]) - 1,
                parseInt(isoMatch[3])
            );
            return {
                date,
                remaining: input.replace(isoMatch[0], '').trim()
            };
        }

        // Default to today if no date found
        return { date: today, remaining: input };
    }

    private parseTime(input: string): { time: { hour: number; minute: number }; remaining: string } | null {
        // 24-hour format: 14:00, 14:30
        const time24Match = input.match(/\b(\d{1,2}):(\d{2})\b/);
        if (time24Match) {
            const hour = parseInt(time24Match[1]);
            const minute = parseInt(time24Match[2]);
            if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
                return {
                    time: { hour, minute },
                    remaining: input.replace(time24Match[0], '').trim()
                };
            }
        }

        // 12-hour format: 2pm, 2:30pm
        const time12Match = input.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
        if (time12Match) {
            let hour = parseInt(time12Match[1]);
            const minute = time12Match[2] ? parseInt(time12Match[2]) : 0;
            const meridiem = time12Match[3].toLowerCase();

            if (meridiem === 'pm' && hour < 12) hour += 12;
            if (meridiem === 'am' && hour === 12) hour = 0;

            if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
                return {
                    time: { hour, minute },
                    remaining: input.replace(time12Match[0], '').trim()
                };
            }
        }

        return null;
    }
}
