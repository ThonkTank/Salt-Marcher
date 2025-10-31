/**
 * NPC Name & Personality Generator
 *
 * Generates procedural NPC names, profiles, and personalities from culture, species, and faction templates.
 * Merges cultural influences with faction characteristics for unique characters.
 * Phase 8.6: Enhanced with quirks, loyalties, secrets, trust, and ambition.
 */

import type { FactionData, NPCPersonality } from "../../workmodes/library/factions/types";

/**
 * Name templates organized by culture
 */
const CULTURE_NAME_TEMPLATES = {
    elven: {
        prefixes: ["Ara", "Eld", "Gal", "Hal", "Ival", "Lass", "Nim", "Sil", "Thal", "Vara"],
        middleComponents: ["adri", "bri", "dor", "lan", "mir", "nor", "ril", "than", "vel"],
        suffixes: ["an", "ara", "dir", "drel", "eth", "las", "lis", "reth", "wen"],
        titles: ["Master", "Lady", "Lord", "Sage", "Guardian"],
    },
    human: {
        prefixes: ["Al", "Bren", "Car", "Dar", "Ed", "Gar", "Hal", "Jon", "Mar", "Sar"],
        middleComponents: ["and", "der", "dor", "eth", "gar", "len", "mar", "ric", "wyn"],
        suffixes: ["a", "an", "en", "er", "is", "on", "yn"],
        titles: ["Captain", "Ser", "Lady", "Lord", "Master"],
    },
    dwarven: {
        prefixes: ["Bar", "Dor", "Dur", "Gor", "Kil", "Mor", "Thar", "Thor", "Ul", "Var"],
        middleComponents: ["ak", "dek", "grim", "kal", "mek", "nak", "rak", "tor"],
        suffixes: ["dar", "gar", "grim", "kal", "rek", "rik", "thane", "var"],
        titles: ["Thane", "Clan Chief", "Master Smith", "Keeper"],
    },
    orcish: {
        prefixes: ["Gra", "Gro", "Gru", "Kra", "Mog", "Nar", "Rak", "Sha", "Ugh", "Zog"],
        middleComponents: ["bash", "gar", "gash", "gul", "kak", "nak", "ruk", "zak"],
        suffixes: ["ak", "bash", "gul", "kur", "mak", "nar", "ruk", "zog"],
        titles: ["Warchief", "Chieftain", "Raider", "Butcher"],
    },
    goblinoid: {
        prefixes: ["Biz", "Gik", "Kra", "Nar", "Nix", "Rag", "Snik", "Vex", "Zik"],
        middleComponents: ["fiz", "gak", "kek", "nak", "rak", "zik"],
        suffixes: ["ak", "ek", "ik", "nix", "uk", "zik"],
        titles: ["Boss", "Skulker", "Chief", "Sneaky"],
    },
    undead: {
        prefixes: ["Mor", "Nec", "Sha", "Ske", "Spec", "Wraith", "Zom"],
        middleComponents: ["ban", "dar", "grim", "mort", "nox", "umbra"],
        suffixes: ["death", "doom", "grimm", "mortis", "shade", "wraith"],
        titles: ["Lord", "King", "Prince", "Baron", "Master"],
    },
    mixed: {
        prefixes: ["Ash", "Bren", "Cor", "Dax", "Eth", "Fen", "Kael", "Mor", "Ryn", "Zara"],
        middleComponents: ["al", "dar", "dor", "eth", "len", "mor", "ren", "var"],
        suffixes: ["a", "an", "el", "en", "is", "or", "yn"],
        titles: ["Master", "Captain", "Leader", "Chief"],
    },
};

/**
 * Role-specific descriptors
 */
const ROLE_DESCRIPTORS = {
    Leader: ["the Wise", "the Mighty", "the Just", "the Fierce", "the Cunning"],
    Scout: ["the Swift", "the Silent", "the Keen", "the Tracker"],
    Guard: ["the Vigilant", "the Steadfast", "the Warden", "the Shield"],
    Worker: ["the Industrious", "the Skilled", "the Builder", "the Crafter"],
    Mage: ["the Arcane", "the Mystic", "the Learned", "the Enchanter"],
    Priest: ["the Devout", "the Blessed", "the Holy", "the Chosen"],
    Warrior: ["the Bold", "the Strong", "the Fearless", "the Veteran"],
    Merchant: ["the Wealthy", "the Shrewd", "the Prosperous", "the Trader"],
};

/**
 * Generate NPC name based on culture, species, and faction
 */
export function generateNPCName(
    culture?: string,
    species?: string,
    role?: string,
    faction?: FactionData,
): string {
    // Determine culture template
    const cultureName = (culture || species || "mixed").toLowerCase();
    const template =
        CULTURE_NAME_TEMPLATES[cultureName as keyof typeof CULTURE_NAME_TEMPLATES] ||
        CULTURE_NAME_TEMPLATES.mixed;

    // Build base name
    const prefix = randomElement(template.prefixes);
    const middle = Math.random() > 0.5 ? randomElement(template.middleComponents) : "";
    const suffix = randomElement(template.suffixes);

    let name = prefix + middle + suffix;

    // Capitalize first letter
    name = name.charAt(0).toUpperCase() + name.slice(1);

    // Add title (50% chance for leaders, 20% for others)
    const titleChance = role === "Leader" ? 0.5 : 0.2;
    if (Math.random() < titleChance) {
        const title = randomElement(template.titles);
        name = `${title} ${name}`;
    }

    // Add descriptor (30% chance for notable roles)
    if (role && Math.random() < 0.3) {
        const descriptors = ROLE_DESCRIPTORS[role as keyof typeof ROLE_DESCRIPTORS];
        if (descriptors) {
            const descriptor = randomElement(descriptors);
            name = `${name} ${descriptor}`;
        }
    }

    return name;
}

/**
 * Generate NPC profile with personality traits
 */
export interface NPCProfile {
    name: string;
    role: string;
    culture: string;
    personality: string[];
    appearance: string;
    background: string;
}

export function generateNPCProfile(
    culture: string,
    species: string,
    role: string,
    faction: FactionData,
): NPCProfile {
    const name = generateNPCName(culture, species, role, faction);

    // Generate personality based on faction culture and goals
    const personality = generatePersonality(faction);

    // Generate appearance based on species and culture
    const appearance = generateAppearance(species, culture);

    // Generate background based on faction and role
    const background = generateBackground(faction, role);

    return {
        name,
        role,
        culture,
        personality,
        appearance,
        background,
    };
}

/**
 * Generate personality traits based on faction
 */
function generatePersonality(faction: FactionData): string[] {
    const traits: string[] = [];

    // Base traits from faction goals
    for (const goalTag of faction.goal_tags || []) {
        const goal = goalTag.value.toLowerCase();

        if (goal.includes("conquest")) {
            traits.push(randomElement(["Aggressive", "Ambitious", "Ruthless"]));
        }
        if (goal.includes("defense")) {
            traits.push(randomElement(["Cautious", "Protective", "Vigilant"]));
        }
        if (goal.includes("trade")) {
            traits.push(randomElement(["Shrewd", "Greedy", "Diplomatic"]));
        }
        if (goal.includes("knowledge")) {
            traits.push(randomElement(["Curious", "Studious", "Wise"]));
        }
    }

    // Add culture-based traits
    for (const cultureTag of faction.culture_tags || []) {
        const culture = cultureTag.value.toLowerCase();

        if (culture.includes("elven")) {
            traits.push(randomElement(["Graceful", "Patient", "Aloof"]));
        }
        if (culture.includes("dwarven")) {
            traits.push(randomElement(["Stubborn", "Honorable", "Hardy"]));
        }
        if (culture.includes("orcish")) {
            traits.push(randomElement(["Fierce", "Direct", "Prideful"]));
        }
        if (culture.includes("human")) {
            traits.push(randomElement(["Adaptable", "Resourceful", "Determined"]));
        }
    }

    // Fill remaining slots with random traits
    const generalTraits = [
        "Loyal",
        "Skeptical",
        "Friendly",
        "Reserved",
        "Brave",
        "Cowardly",
        "Honest",
        "Cunning",
        "Compassionate",
        "Callous",
    ];

    while (traits.length < 3) {
        const trait = randomElement(generalTraits);
        if (!traits.includes(trait)) {
            traits.push(trait);
        }
    }

    return traits.slice(0, 3);
}

/**
 * Generate appearance description
 */
function generateAppearance(species: string, culture: string): string {
    const speciesLower = species.toLowerCase();
    const cultureLower = culture.toLowerCase();

    const appearances: string[] = [];

    // Species-based features
    if (speciesLower.includes("elf")) {
        appearances.push(
            randomElement([
                "tall and slender with pointed ears",
                "graceful build with silver hair",
                "angular features and piercing eyes",
            ]),
        );
    } else if (speciesLower.includes("dwarf")) {
        appearances.push(
            randomElement([
                "stocky and muscular with a braided beard",
                "sturdy build with calloused hands",
                "broad-shouldered with weathered features",
            ]),
        );
    } else if (speciesLower.includes("orc") || speciesLower.includes("orcish")) {
        appearances.push(
            randomElement([
                "powerfully built with green skin",
                "muscular frame with prominent tusks",
                "imposing stature with scarred features",
            ]),
        );
    } else if (speciesLower.includes("goblin")) {
        appearances.push(
            randomElement([
                "small and wiry with sharp features",
                "nimble build with oversized ears",
                "quick movements and beady eyes",
            ]),
        );
    } else {
        // Human or mixed
        appearances.push(
            randomElement([
                "average build with weathered features",
                "lean and athletic",
                "sturdy frame with confident bearing",
            ]),
        );
    }

    // Cultural adornments
    if (cultureLower.includes("military")) {
        appearances.push("wearing well-maintained armor");
    } else if (cultureLower.includes("religious")) {
        appearances.push("adorned with religious symbols");
    } else if (cultureLower.includes("scholarly")) {
        appearances.push("carrying scrolls and books");
    }

    return appearances.join(", ");
}

/**
 * Generate background story
 */
function generateBackground(faction: FactionData, role: string): string {
    const backgrounds = [
        `A devoted member of ${faction.name}, serving in the role of ${role}.`,
        `Rose through the ranks of ${faction.name} to become ${role}.`,
        `A trusted ${role} who has served ${faction.name} for many years.`,
        `Recently appointed as ${role} within ${faction.name}.`,
    ];

    let background = randomElement(backgrounds);

    // Add faction-specific context
    if (faction.motto) {
        background += ` Believes strongly in "${faction.motto}".`;
    }

    return background;
}

/**
 * Helper: Get random element from array
 */
function randomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate multiple NPCs for a faction
 */
export function generateFactionNPCs(
    faction: FactionData,
    count: number,
    roles?: string[],
): NPCProfile[] {
    const npcs: NPCProfile[] = [];

    // Determine primary culture
    const primaryCulture =
        faction.culture_tags && faction.culture_tags.length > 0
            ? faction.culture_tags[0].value
            : "Mixed";

    // Use provided roles or generate random ones
    const defaultRoles = ["Leader", "Scout", "Guard", "Worker", "Mage", "Warrior"];

    for (let i = 0; i < count; i++) {
        const role = roles
            ? roles[i % roles.length]
            : randomElement(defaultRoles);

        const npc = generateNPCProfile(primaryCulture, primaryCulture, role, faction);
        npcs.push(npc);
    }

    return npcs;
}

// ============================================================================
// Phase 8.6: NPC Personality System
// ============================================================================

/**
 * Quirk templates organized by archetype
 */
const QUIRK_TEMPLATES = {
    speech: [
        "Always quotes poetry",
        "Speaks in third person",
        "Has a nervous stutter",
        "Uses elaborate metaphors",
        "Punctuates sentences with proverbs",
        "Rhymes unintentionally",
        "Whispers dramatically",
    ],
    habits: [
        "Constantly polishes weapons",
        "Fidgets with jewelry",
        "Collects strange trinkets",
        "Writes everything in a journal",
        "Hums ancient battle hymns",
        "Chews on herbs",
        "Counts things obsessively",
    ],
    beliefs: [
        "Superstitious about omens",
        "Believes animals can talk",
        "Trusts only written contracts",
        "Fears magical items",
        "Convinced they're cursed",
        "Prays before every meal",
        "Refuses to work on holy days",
    ],
    phobias: [
        "Afraid of heights",
        "Dislikes underground spaces",
        "Uncomfortable around magic",
        "Paranoid about poison",
        "Nervous around authority",
        "Avoids water",
        "Scared of the dark",
    ],
    social: [
        "Tells bad jokes constantly",
        "Name-drops important contacts",
        "Brags about past victories",
        "Apologizes for everything",
        "Questions every order",
        "Flirts inappropriately",
        "Always late to meetings",
    ],
};

/**
 * Loyalty templates organized by target type
 */
const LOYALTY_TEMPLATES = {
    faction: [
        "Unwavering loyalty to {faction}",
        "Would die for {faction}'s cause",
        "Believes {faction} is the only hope",
        "Devoted to {faction}'s ideals",
    ],
    individual: [
        "Owes life debt to {name}",
        "Secretly loves {name}",
        "Protects {name} at all costs",
        "Mentored by {name}",
        "Sworn brother/sister to {name}",
    ],
    ideal: [
        "Loyal to honor above all",
        "Dedicated to justice",
        "Serves only the greater good",
        "Believes in freedom for all",
        "Faithful to ancient traditions",
        "Committed to knowledge",
    ],
    conditional: [
        "Loyal only while paid well",
        "Serves out of fear",
        "Stays for personal gain",
        "Loyalty fades without victories",
    ],
};

/**
 * Secret templates organized by severity
 */
const SECRET_TEMPLATES = {
    dark: [
        "Murdered an innocent person",
        "Betrayed a previous faction",
        "Secretly worships a dark god",
        "Guilty of war crimes",
        "Has killed a fellow member",
    ],
    dangerous: [
        "Planning to overthrow leadership",
        "Spying for an enemy faction",
        "Hiding a criminal past",
        "Knows faction's darkest secret",
        "Stole from the faction treasury",
    ],
    personal: [
        "Has a hidden family",
        "Suffers from an addiction",
        "Hiding noble heritage",
        "Failed an important mission",
        "Secretly doubts the cause",
    ],
    ambitions: [
        "Plans to seize power someday",
        "Wants to replace current leader",
        "Seeks to create a splinter faction",
        "Collecting leverage on rivals",
        "Building a secret network",
    ],
};

/**
 * Generate complete NPC personality
 */
export function generateNPCPersonality(
    faction: FactionData,
    role: string,
    otherNPCs?: string[],
): NPCPersonality {
    const quirks = generateQuirks(role);
    const loyalties = generateLoyalties(faction, role, otherNPCs);
    const secrets = generateSecrets(role);
    const trust = generateTrustLevel(faction, role);
    const ambition = generateAmbitionLevel(role);

    return {
        quirks,
        loyalties,
        secrets,
        trust,
        ambition,
    };
}

/**
 * Generate quirks based on role
 */
function generateQuirks(role: string): string[] {
    const quirks: string[] = [];
    const numQuirks = Math.random() < 0.5 ? 1 : 2;

    const categories = Object.keys(QUIRK_TEMPLATES) as Array<keyof typeof QUIRK_TEMPLATES>;

    for (let i = 0; i < numQuirks; i++) {
        const category = randomElement(categories);
        const quirk = randomElement(QUIRK_TEMPLATES[category]);
        if (!quirks.includes(quirk)) {
            quirks.push(quirk);
        }
    }

    return quirks;
}

/**
 * Generate loyalties based on faction, role, and other NPCs
 */
function generateLoyalties(
    faction: FactionData,
    role: string,
    otherNPCs?: string[],
): string[] {
    const loyalties: string[] = [];

    // Leaders always have strong faction loyalty
    if (role === "Leader") {
        const template = randomElement(LOYALTY_TEMPLATES.faction);
        loyalties.push(template.replace("{faction}", faction.name));
    } else {
        // 70% chance of faction loyalty for non-leaders
        if (Math.random() < 0.7) {
            const template = randomElement(LOYALTY_TEMPLATES.faction);
            loyalties.push(template.replace("{faction}", faction.name));
        }
    }

    // 40% chance of individual loyalty (to another NPC)
    if (otherNPCs && otherNPCs.length > 0 && Math.random() < 0.4) {
        const target = randomElement(otherNPCs);
        const template = randomElement(LOYALTY_TEMPLATES.individual);
        loyalties.push(template.replace("{name}", target));
    }

    // 30% chance of ideological loyalty
    if (Math.random() < 0.3) {
        loyalties.push(randomElement(LOYALTY_TEMPLATES.ideal));
    }

    // 20% chance of conditional loyalty (may indicate potential betrayal)
    if (Math.random() < 0.2) {
        loyalties.push(randomElement(LOYALTY_TEMPLATES.conditional));
    }

    return loyalties;
}

/**
 * Generate secrets based on role
 */
function generateSecrets(role: string): string[] {
    const secrets: string[] = [];

    // Leaders and ambitious roles more likely to have secrets
    const secretChance = role === "Leader" ? 0.6 : 0.4;

    if (Math.random() < secretChance) {
        const categories = Object.keys(SECRET_TEMPLATES) as Array<keyof typeof SECRET_TEMPLATES>;
        const category = randomElement(categories);
        secrets.push(randomElement(SECRET_TEMPLATES[category]));
    }

    return secrets;
}

/**
 * Generate trust level toward faction (0-100)
 */
function generateTrustLevel(faction: FactionData, role: string): number {
    // Base trust depends on role
    let baseTrust = 50;

    if (role === "Leader") {
        baseTrust = 80; // Leaders typically highly trusted
    } else if (role === "Guard" || role === "Warrior") {
        baseTrust = 70; // Military roles generally trusted
    } else if (role === "Scout") {
        baseTrust = 60; // Scouts operate independently
    }

    // Add some randomness
    const variance = Math.floor(Math.random() * 30) - 15; // -15 to +15
    return Math.max(0, Math.min(100, baseTrust + variance));
}

/**
 * Generate ambition level (0-100)
 */
function generateAmbitionLevel(role: string): number {
    // Base ambition depends on role
    let baseAmbition = 50;

    if (role === "Leader") {
        baseAmbition = 70; // Leaders often ambitious
    } else if (role === "Warrior" || role === "Scout") {
        baseAmbition = 60; // Combat roles seek glory
    } else if (role === "Worker") {
        baseAmbition = 30; // Workers typically content
    }

    // Add randomness
    const variance = Math.floor(Math.random() * 40) - 20; // -20 to +20
    return Math.max(0, Math.min(100, baseAmbition + variance));
}

/**
 * Update NPC loyalty based on events
 */
export function updateNPCLoyalty(
    personality: NPCPersonality,
    change: number,
    reason?: string,
): NPCPersonality {
    const newTrust = Math.max(0, Math.min(100, (personality.trust || 50) + change));

    // If trust drops significantly, may add disloyal secret
    if (newTrust < 30 && (personality.secrets?.length || 0) === 0) {
        personality.secrets = personality.secrets || [];
        personality.secrets.push(randomElement(SECRET_TEMPLATES.dangerous));
    }

    personality.trust = newTrust;

    // Add loyalty note if reason provided
    if (reason && change !== 0) {
        personality.loyalties = personality.loyalties || [];
        if (change > 0) {
            personality.loyalties.push(`Grateful for: ${reason}`);
        } else {
            personality.loyalties.push(`Resentful about: ${reason}`);
        }
    }

    return personality;
}

/**
 * Check if NPC is likely to betray faction
 */
export function isLikelyToBetray(personality: NPCPersonality): boolean {
    const trust = personality.trust || 50;
    const ambition = personality.ambition || 50;

    // Low trust + high ambition = betrayal risk
    if (trust < 30 && ambition > 70) {
        return Math.random() < 0.7; // 70% chance
    }

    // Very low trust alone is risky
    if (trust < 20) {
        return Math.random() < 0.5; // 50% chance
    }

    // Check for disloyal secrets
    const hasDisloyalSecret = personality.secrets?.some(
        (s) =>
            s.includes("overthrow") ||
            s.includes("spying") ||
            s.includes("seize power"),
    );

    if (hasDisloyalSecret) {
        return Math.random() < 0.6; // 60% chance
    }

    return false;
}
