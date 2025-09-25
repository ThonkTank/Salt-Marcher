// src/core/translator.ts
export interface TranslationRequest {
    text: string;
    target: string;
    source?: string;
}

export interface TranslationResult {
    translatedText: string;
    detectedSourceLanguage?: string;
}

const GOOGLE_TRANSLATE_ENDPOINT = "https://translate.googleapis.com/translate_a/single";

/**
 * Übersetzt einen Text mithilfe des inoffiziellen Google-Translate-Endpunkts.
 * Bei Fehlern wird der Originaltext zurückgegeben, damit der Nutzer weiterarbeiten kann.
 */
export async function translateText({ text, target, source }: TranslationRequest): Promise<TranslationResult> {
    if (!text.trim()) {
        return { translatedText: "", detectedSourceLanguage: source };
    }

    const params = new URLSearchParams({
        client: "gtx",
        sl: source || "auto",
        tl: target,
        dt: "t",
        q: text,
    });

    try {
        const response = await fetch(`${GOOGLE_TRANSLATE_ENDPOINT}?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const body = await response.json();
        const translated = Array.isArray(body?.[0])
            ? body[0].map((chunk: any[]) => chunk?.[0] ?? "").join("")
            : text;
        const detected = typeof body?.[2] === "string" ? body[2] : source;
        return { translatedText: translated, detectedSourceLanguage: detected };
    } catch (error) {
        console.error("translateText failed", error);
        return { translatedText: text, detectedSourceLanguage: source };
    }
}
