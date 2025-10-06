// Einfacher Test für den Parser ohne Obsidian Dependencies
import { readFileSync } from 'fs';

// Kopiere nur die Parse-Funktionen hier herein für den Test
type StatblockData = any; // Vereinfacht für Test

const apeMarkdown = `# Ape

*Medium Beast, Unaligned*

- **Armor Class:** 12
- **Hit Points:** 19 (3d8 + 6)
- **Speed:** 30 ft., Climb 30 ft.
- **Initiative**: +2 (12)

|STAT|SCORE|MOD|SAVE|
| --- | --- | --- | ---- |
| STR | 16 | +3 | +3 |
| DEX | 14 | +2 | +2 |
| CON | 14 | +2 | +2 |
| INT | 6 | -2 | -2 |
| WIS | 12 | +1 | +1 |
| CHA | 7 | -2 | -2 |

- **Skills**: Athletics +5, Perception +3
- **Senses**: Passive Perception 13
- **CR** 1/2 (XP 100; PB +2)

### Actions

***Multiattack.*** The ape makes two Fist attacks.

***Fist.*** *Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Bludgeoning damage.

***Rock (Recharge 6).*** *Ranged Attack Roll:* +5, range 25/50 ft. 10 (2d6 + 3) Bludgeoning damage.
`;

function extractH1(lines: string[]): string {
    for (const line of lines) {
        const match = line.match(/^#\s+(.+)$/);
        if (match) return match[1].trim();
    }
    return "Unknown Creature";
}

function extractSubtitle(lines: string[]): string | null {
    for (const line of lines) {
        const match = line.match(/^\*(.+)\*$/);
        if (match) return match[1].trim();
    }
    return null;
}

function parseSubtitle(subtitle: string) {
    const parts = subtitle.split(',').map(p => p.trim());
    if (parts.length === 0) return {};

    const firstPart = parts[0];
    const secondPart = parts[1];

    const result: any = {};

    const typeMatch = firstPart.match(/^(\w+)\s+(.+)$/);
    if (typeMatch) {
        result.size = typeMatch[1];
        const typeWithTags = typeMatch[2];

        const tagMatch = typeWithTags.match(/^(.+?)\s*\((.+)\)$/);
        if (tagMatch) {
            result.type = tagMatch[1].trim();
            result.typeTags = tagMatch[2].split(',').map((t: string) => t.trim());
        } else {
            result.type = typeWithTags;
        }
    }

    if (secondPart) {
        result.alignment = secondPart;
    }

    return result;
}

console.log('=== Testing Parser Functions ===\n');

const lines = apeMarkdown.split('\n').map(line => line.trim());

console.log('1. Extract H1:');
const name = extractH1(lines);
console.log('   Name:', name);

console.log('\n2. Extract Subtitle:');
const subtitle = extractSubtitle(lines);
console.log('   Subtitle:', subtitle);

console.log('\n3. Parse Subtitle:');
if (subtitle) {
    const parsed = parseSubtitle(subtitle);
    console.log('   Size:', parsed.size);
    console.log('   Type:', parsed.type);
    console.log('   Alignment:', parsed.alignment);
}

console.log('\n=== Test successful ===');
