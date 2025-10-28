#!/usr/bin/env node
// parse-entries.mjs
// Parses unstructured entry text into structured data for VTT automation

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREATURES_DIR = path.join(__dirname, 'Presets', 'Creatures');

function getAllMarkdownFiles(dir) {
    let files = [];
    try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
                files = files.concat(getAllMarkdownFiles(fullPath));
            } else if (item.isFile() && item.name.endsWith('.md')) {
                files.push(fullPath);
            }
        }
    } catch (err) {}
    return files;
}

// Parse attack text like "*Melee Attack Roll:* +12, reach 10 ft. 16 (2d8 + 7) Slashing damage plus 5 (1d10) Lightning damage."
function parseAttack(text) {
    // Match attack type (note: colon comes BEFORE closing asterisk)
    const attackTypeMatch = text.match(/\*(Melee|Ranged) Attack Roll:\*/i);
    if (!attackTypeMatch) return null;

    const type = attackTypeMatch[1].toLowerCase();

    // Match attack bonus
    const bonusMatch = text.match(/Attack Roll:\*\s*([+-]\d+)/);
    if (!bonusMatch) return null;
    const bonus = parseInt(bonusMatch[1]);

    // Match reach/range
    const reachMatch = text.match(/reach\s+(\d+\s*ft\.)/i);
    const rangeMatch = text.match(/range\s+(\d+(?:\/\d+)?\s*ft\.)/i);
    const reach = reachMatch ? reachMatch[1] : undefined;
    const range = rangeMatch ? rangeMatch[1] : undefined;

    // Parse damage instances
    const damage = [];

    // Pattern: "16 (2d8 + 7) Slashing damage"
    const damagePattern = /(\d+)\s*\(([^)]+)\)\s+(\w+)\s+damage/gi;
    let match;
    while ((match = damagePattern.exec(text)) !== null) {
        const average = parseInt(match[1]);
        const diceStr = match[2].trim();
        const damageType = match[3];

        // Parse dice string like "2d8 + 7" or "1d10"
        const diceMatch = diceStr.match(/(\d+d\d+)(?:\s*\+\s*(\d+))?/);
        if (diceMatch) {
            damage.push({
                dice: diceMatch[1],
                bonus: diceMatch[2] ? parseInt(diceMatch[2]) : 0,
                type: damageType,
                average: average,
            });
        }
    }

    if (damage.length === 0) return null;

    // Extract additional effects (everything after the last damage)
    const lastDamageIndex = text.lastIndexOf('damage');
    const afterDamage = text.substring(lastDamageIndex + 6).trim();
    const additionalEffects = afterDamage.length > 1 ? afterDamage : undefined;

    return {
        type,
        bonus,
        reach,
        range,
        damage,
        additionalEffects,
    };
}

// Parse saving throw like "*Dexterity Saving Throw*: DC 19, each creature in a 90-foot-long, 5-foot-wide Line. *Failure:*  60 (11d10) Lightning damage. *Success:*  Half damage."
function parseSavingThrow(text) {
    // Match save ability and DC
    const saveMatch = text.match(/\*(\w+) Saving Throw\*:\s*DC\s*(\d+)/i);
    if (!saveMatch) return null;

    const abilityMap = {
        'strength': 'str',
        'dexterity': 'dex',
        'constitution': 'con',
        'intelligence': 'int',
        'wisdom': 'wis',
        'charisma': 'cha',
    };
    const ability = abilityMap[saveMatch[1].toLowerCase()];
    const dc = parseInt(saveMatch[2]);

    if (!ability) return null;

    // Extract area/targets (text between DC and *Failure*)
    const areaMatch = text.match(/DC\s*\d+,\s*(.+?)\.\s*\*Failure/i);
    const area = areaMatch ? areaMatch[1].trim() : undefined;

    // Parse failure effect
    const failMatch = text.match(/\*Failure:?\*\s*(.+?)(?:\*Success|\*Failure or Success|$)/is);
    let onFail = undefined;
    if (failMatch) {
        const failText = failMatch[1].trim();

        // Try to parse damage
        const failDamageMatch = failText.match(/(\d+)\s*\(([^)]+)\)\s+(\w+)\s+damage/i);
        if (failDamageMatch) {
            const average = parseInt(failDamageMatch[1]);
            const diceStr = failDamageMatch[2].trim();
            const damageType = failDamageMatch[3];

            const diceMatch = diceStr.match(/(\d+d\d+)(?:\s*\+\s*(\d+))?/);
            if (diceMatch) {
                onFail = {
                    damage: [{
                        dice: diceMatch[1],
                        bonus: diceMatch[2] ? parseInt(diceMatch[2]) : 0,
                        type: damageType,
                        average: average,
                    }],
                };

                // Check for additional effects after damage
                const effectsAfterDamage = failText.substring(failText.indexOf('damage') + 6).trim();
                if (effectsAfterDamage.length > 1) {
                    onFail.effects = effectsAfterDamage;
                }
            }
        } else {
            // No damage, just effects
            onFail = {
                effects: failText,
            };
        }
    }

    // Parse success effect
    const successMatch = text.match(/\*Success:?\*\s*(.+?)(?:\.|$)/i);
    const onSuccess = successMatch ? successMatch[1].trim() : undefined;

    return {
        ability,
        dc,
        area,
        onFail,
        onSuccess,
    };
}

// Parse multiattack like "The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Shatter*."
function parseMultiattack(text) {
    const result = {
        attacks: [],
        substitutions: [],
    };

    // Pattern: "makes three Rend attacks"
    const attackPattern = /makes\s+(?:(\w+)\s+)?(\w+(?:\s+\w+)?)\s+attacks?/gi;
    let match;
    while ((match = attackPattern.exec(text)) !== null) {
        const countStr = match[1];
        const name = match[2];

        // Convert word numbers to digits
        const countMap = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        };
        const count = countMap[countStr?.toLowerCase()] || parseInt(countStr) || 1;

        result.attacks.push({ name, count });
    }

    // Pattern: "can replace one attack with"
    const substitutePattern = /can replace\s+(?:(\w+)\s+)?(?:(\w+)\s+)?attacks?\s+with\s+(?:a\s+use\s+of\s+)?(.+?)(?:\.|$)/i;
    const subMatch = text.match(substitutePattern);
    if (subMatch) {
        const countStr = subMatch[1];
        const count = countStr ? (countMap[countStr.toLowerCase()] || parseInt(countStr) || 1) : 1;
        const withWhat = subMatch[3].trim();

        result.substitutions.push({
            replace: result.attacks[0]?.name || 'attack',
            with: withWhat,
            count,
        });
    }

    return result.attacks.length > 0 ? result : null;
}

// Parse spellcasting like "The dragon casts one of the following spells..."
function parseSpellcasting(text) {
    // Extract spellcasting ability
    const abilityMatch = text.match(/using\s+(\w+)\s+as\s+the\s+spellcasting\s+ability/i);
    const abilityMap = {
        'strength': 'str', 'dexterity': 'dex', 'constitution': 'con',
        'intelligence': 'int', 'wisdom': 'wis', 'charisma': 'cha',
    };
    const ability = abilityMatch ? abilityMap[abilityMatch[1].toLowerCase()] : undefined;

    // Extract save DC
    const dcMatch = text.match(/spell\s+save\s+DC\s+(\d+)/i);
    const saveDC = dcMatch ? parseInt(dcMatch[1]) : undefined;

    // Extract attack bonus
    const attackMatch = text.match(/([+-]\d+)\s+to\s+hit\s+with\s+spell\s+attacks/i);
    const attackBonus = attackMatch ? parseInt(attackMatch[1]) : undefined;

    // Extract excluded components
    const excludeComponents = [];
    if (text.match(/requiring\s+no\s+Material\s+components?/i)) {
        excludeComponents.push('M');
    }
    if (text.match(/requiring\s+no\s+(?:Verbal\s+or\s+)?Somatic\s+components?/i)) {
        excludeComponents.push('S');
    }

    // Parse spell lists
    const spellLists = [];

    // At will spells
    const atWillMatch = text.match(/\*\*At Will:?\*\*\s*([^-*]+)/i);
    if (atWillMatch) {
        const spells = atWillMatch[1]
            .split(',')
            .map(s => s.replace(/\*/g, '').trim())
            .filter(s => s.length > 0);
        if (spells.length > 0) {
            spellLists.push({ frequency: 'at-will', spells });
        }
    }

    // Per day spells
    const perDayPattern = /\*\*(\d+)\/Day(?:\s+Each)?:?\*\*\s*([^-*]+)/gi;
    let perDayMatch;
    while ((perDayMatch = perDayPattern.exec(text)) !== null) {
        const frequency = `${perDayMatch[1]}/day`;
        const spells = perDayMatch[2]
            .split(',')
            .map(s => s.replace(/\*/g, '').trim())
            .filter(s => s.length > 0);
        if (spells.length > 0) {
            spellLists.push({ frequency, spells });
        }
    }

    if (!ability && !saveDC && spellLists.length === 0) return null;

    return {
        ability,
        saveDC,
        attackBonus,
        excludeComponents: excludeComponents.length > 0 ? excludeComponents : undefined,
        spellLists,
    };
}

// Extract limited use from name like "Legendary Resistance (3/Day)"
function parseLimitedUse(name) {
    const match = name.match(/\((\d+)\/([^)]+)\)/i);
    if (!match) return undefined;

    const count = parseInt(match[1]);
    const resetStr = match[2].toLowerCase().trim();

    const resetMap = {
        'day': 'day',
        'short rest': 'short-rest',
        'long rest': 'long-rest',
        'dawn': 'dawn',
        'dusk': 'dusk',
    };
    const reset = resetMap[resetStr] || 'day';

    return { count, reset };
}

// Extract recharge from name like "Lightning Breath (Recharge 5-6)"
function parseRecharge(name) {
    const match = name.match(/\(Recharge\s+([0-9-]+)\)/i);
    return match ? match[1] : undefined;
}

// Determine entry type from text content
function determineEntryType(entry) {
    const text = entry.text || '';
    const name = entry.name || '';

    // Check for multiattack
    if (name.toLowerCase().includes('multiattack') || text.match(/makes\s+\w+\s+\w+\s+attacks?/i)) {
        const multiattack = parseMultiattack(text);
        if (multiattack) {
            return { entryType: 'multiattack', multiattack };
        }
    }

    // Check for spellcasting
    if (name.toLowerCase().includes('spellcast') || text.match(/casts?\s+(?:one\s+of\s+)?the\s+following\s+spells?/i)) {
        const spellcasting = parseSpellcasting(text);
        if (spellcasting) {
            return { entryType: 'spellcasting', spellcasting };
        }
    }

    // Check for attack
    if (text.match(/\*(Melee|Ranged) Attack Roll\*:/i)) {
        const attack = parseAttack(text);
        if (attack) {
            return { entryType: 'attack', attack };
        }
    }

    // Check for saving throw
    if (text.match(/\*\w+ Saving Throw\*:/i)) {
        const save = parseSavingThrow(text);
        if (save) {
            return { entryType: 'save', save };
        }
    }

    // Default to special
    return { entryType: 'special' };
}

// Process a single entry
function processEntry(entry) {
    const result = {
        category: entry.category,
        name: entry.name,
        text: entry.text,
    };

    // Extract recharge
    const recharge = parseRecharge(entry.name);
    if (recharge) {
        result.recharge = recharge;
    }

    // Extract limited use
    const limitedUse = parseLimitedUse(entry.name);
    if (limitedUse) {
        result.limitedUse = limitedUse;
    }

    // Determine type and parse structured data
    const typeData = determineEntryType(entry);
    Object.assign(result, typeData);

    return result;
}

// Process all entries in a file
function processFileEntries(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let inFrontmatter = false;
    let inEntries = false;
    let currentEntry = null;
    const entries = [];
    const result = [];
    let indentLevel = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Track frontmatter boundaries
        if (line === '---') {
            if (!inFrontmatter) {
                inFrontmatter = true;
                result.push(line);
                continue;
            } else {
                inFrontmatter = false;
                inEntries = false;

                // Process collected entries
                if (entries.length > 0) {
                    result.push('entries:');
                    for (const entry of entries) {
                        const processed = processEntry(entry);
                        result.push('  -');
                        result.push(`    category: "${processed.category}"`);
                        result.push(`    name: "${processed.name}"`);

                        if (processed.entryType) {
                            result.push(`    entryType: "${processed.entryType}"`);
                        }

                        if (processed.recharge) {
                            result.push(`    recharge: "${processed.recharge}"`);
                        }

                        if (processed.limitedUse) {
                            result.push(`    limitedUse:`);
                            result.push(`      count: ${processed.limitedUse.count}`);
                            result.push(`      reset: "${processed.limitedUse.reset}"`);
                        }

                        if (processed.attack) {
                            result.push(`    attack:`);
                            result.push(`      type: "${processed.attack.type}"`);
                            result.push(`      bonus: ${processed.attack.bonus}`);
                            if (processed.attack.reach) {
                                result.push(`      reach: "${processed.attack.reach}"`);
                            }
                            if (processed.attack.range) {
                                result.push(`      range: "${processed.attack.range}"`);
                            }
                            result.push(`      damage:`);
                            for (const dmg of processed.attack.damage) {
                                result.push(`        -`);
                                if (dmg.dice) result.push(`          dice: "${dmg.dice}"`);
                                if (dmg.bonus) result.push(`          bonus: ${dmg.bonus}`);
                                result.push(`          type: "${dmg.type}"`);
                                if (dmg.average) result.push(`          average: ${dmg.average}`);
                            }
                            if (processed.attack.additionalEffects) {
                                result.push(`      additionalEffects: "${processed.attack.additionalEffects}"`);
                            }
                        }

                        if (processed.save) {
                            result.push(`    save:`);
                            result.push(`      ability: "${processed.save.ability}"`);
                            result.push(`      dc: ${processed.save.dc}`);
                            if (processed.save.area) {
                                result.push(`      area: "${processed.save.area}"`);
                            }
                            if (processed.save.onFail) {
                                result.push(`      onFail:`);
                                if (processed.save.onFail.damage) {
                                    result.push(`        damage:`);
                                    for (const dmg of processed.save.onFail.damage) {
                                        result.push(`          -`);
                                        if (dmg.dice) result.push(`            dice: "${dmg.dice}"`);
                                        if (dmg.bonus) result.push(`            bonus: ${dmg.bonus}`);
                                        result.push(`            type: "${dmg.type}"`);
                                        if (dmg.average) result.push(`            average: ${dmg.average}`);
                                    }
                                }
                                if (processed.save.onFail.effects) {
                                    result.push(`        effects: "${processed.save.onFail.effects}"`);
                                }
                            }
                            if (processed.save.onSuccess) {
                                result.push(`      onSuccess: "${processed.save.onSuccess}"`);
                            }
                        }

                        if (processed.multiattack) {
                            result.push(`    multiattack:`);
                            result.push(`      attacks:`);
                            for (const atk of processed.multiattack.attacks) {
                                result.push(`        -`);
                                result.push(`          name: "${atk.name}"`);
                                result.push(`          count: ${atk.count}`);
                            }
                            if (processed.multiattack.substitutions && processed.multiattack.substitutions.length > 0) {
                                result.push(`      substitutions:`);
                                for (const sub of processed.multiattack.substitutions) {
                                    result.push(`        -`);
                                    result.push(`          replace: "${sub.replace}"`);
                                    result.push(`          with: "${sub.with}"`);
                                    if (sub.count) result.push(`          count: ${sub.count}`);
                                }
                            }
                        }

                        if (processed.spellcasting) {
                            result.push(`    spellcasting:`);
                            if (processed.spellcasting.ability) {
                                result.push(`      ability: "${processed.spellcasting.ability}"`);
                            }
                            if (processed.spellcasting.saveDC) {
                                result.push(`      saveDC: ${processed.spellcasting.saveDC}`);
                            }
                            if (processed.spellcasting.attackBonus) {
                                result.push(`      attackBonus: ${processed.spellcasting.attackBonus}`);
                            }
                            if (processed.spellcasting.excludeComponents) {
                                result.push(`      excludeComponents: [${processed.spellcasting.excludeComponents.map(c => `"${c}"`).join(', ')}]`);
                            }
                            if (processed.spellcasting.spellLists.length > 0) {
                                result.push(`      spellLists:`);
                                for (const list of processed.spellcasting.spellLists) {
                                    result.push(`        -`);
                                    result.push(`          frequency: "${list.frequency}"`);
                                    result.push(`          spells: [${list.spells.map(s => `"${s}"`).join(', ')}]`);
                                }
                            }
                        }

                        if (processed.text) {
                            result.push(`    text: "${processed.text.replace(/"/g, '\\"')}"`);
                        }
                    }
                }

                result.push(line);
                continue;
            }
        }

        if (!inFrontmatter) {
            result.push(line);
            continue;
        }

        // Check if we're starting entries section
        if (line.match(/^entries:\s*$/)) {
            inEntries = true;
            entries.length = 0; // Clear array
            continue;
        }

        if (!inEntries) {
            result.push(line);
            continue;
        }

        // Parse entry fields
        const indent = line.match(/^(\s*)/)[1].length;

        if (line.match(/^\s+-\s*$/)) {
            // New entry
            if (currentEntry) {
                entries.push(currentEntry);
            }
            currentEntry = {};
            indentLevel = indent;
        } else if (currentEntry) {
            const fieldMatch = line.match(/^\s+(\w+):\s*"?([^"]*)"?\s*$/);
            if (fieldMatch) {
                const [, key, value] = fieldMatch;
                if (key === 'category' || key === 'name' || key === 'text') {
                    currentEntry[key] = value;
                }
            }
        }
    }

    // Don't forget the last entry
    if (currentEntry && Object.keys(currentEntry).length > 0) {
        entries.push(currentEntry);
    }

    return result.join('\n');
}

function main() {
    console.log('Finding creature preset files...');
    const files = getAllMarkdownFiles(CREATURES_DIR);
    console.log(`Found ${files.length} files`);

    let processedCount = 0;
    let errorCount = 0;

    for (const filePath of files) {
        try {
            const originalContent = fs.readFileSync(filePath, 'utf-8');

            // Only process files that have entries
            if (!originalContent.includes('entries:')) {
                continue;
            }

            const processedContent = processFileEntries(filePath);

            // Only write if content changed
            if (originalContent !== processedContent) {
                fs.writeFileSync(filePath, processedContent, 'utf-8');
                processedCount++;
                console.log(`✓ Processed: ${path.relative(CREATURES_DIR, filePath)}`);
            }
        } catch (err) {
            console.error(`✗ Error processing ${filePath}:`, err.message);
            errorCount++;
        }
    }

    console.log(`\nComplete! Processed ${processedCount} files, ${errorCount} errors`);
}

main();
