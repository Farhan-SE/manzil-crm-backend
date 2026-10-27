import { Injectable } from '@nestjs/common';

/** What the chatbot has gathered so far; see manzil-ai-service's app/domain/property.py. */
export interface PropertyEnquiry {
    purpose: 'rent' | 'buy' | null;
    property_type: 'house' | 'apartment' | 'plot' | 'commercial' | null;
    area: string | null;
    portion: 'upper' | 'lower' | 'full' | null;
    beds: number | null;
    budget: number | null;
}

export interface PropertyChatTurn {
    reply: string;
    reply_language: 'ur' | 'en';
    parameters: PropertyEnquiry;
    all_collected: boolean;
    /** Everything is known and something changed since the last search: answer with matching units. */
    search: boolean;
    lead_key: string | null;
    session_reset: boolean;
    /** The customer asked for photos or videos of a listed property; media_choice is its list number, if they said. */
    media_request?: boolean;
    media_choice?: number | null;
}

@Injectable()
export class PropertyChatClient {
    isConfigured() {
        return Boolean(process.env.AI_SERVICE_URL);
    }

    async send(message: string, sessionId: string): Promise<PropertyChatTurn> {
        const res = await fetch(`${process.env.AI_SERVICE_URL!.replace(/\/$/, '')}/property-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.AI_SERVICE_KEY ?? '' },
            body: JSON.stringify({ message, session_id: sessionId }),
            signal: AbortSignal.timeout(45_000),
        });
        if (!res.ok) throw new Error(`AI service answered ${res.status}: ${await res.text().catch(() => '')}`);
        return (await res.json()) as PropertyChatTurn;
    }
}
