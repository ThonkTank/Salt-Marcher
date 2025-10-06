// Temporäres Test-Script für den Reference Parser
import { readFileSync } from 'fs';
import { parseReferenceStatblock } from './src/apps/library/core/reference-parser';
import { statblockToMarkdown } from './src/apps/library/core/creature-files';

const apeMarkdown = readFileSync('./References/rulebooks/Statblocks/Creatures/Animals/ape.md', 'utf-8');
const abolethMarkdown = readFileSync('./References/rulebooks/Statblocks/Creatures/Monsters/aboleth.md', 'utf-8');

console.log('=== Testing Ape ===');
const apeParsed = parseReferenceStatblock(apeMarkdown);
console.log(JSON.stringify(apeParsed, null, 2));

console.log('\n=== Ape converted to StatblockData format ===');
const apeConverted = statblockToMarkdown(apeParsed);
console.log(apeConverted);

console.log('\n\n=== Testing Aboleth ===');
const abolethParsed = parseReferenceStatblock(abolethMarkdown);
console.log(JSON.stringify(abolethParsed, null, 2));

console.log('\n=== Aboleth converted to StatblockData format ===');
const abolethConverted = statblockToMarkdown(abolethParsed);
console.log(abolethConverted);
