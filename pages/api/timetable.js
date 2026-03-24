// Simple iCal parser for timetable syncing
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

    try {
        const { link } = req.query;

        if (!link || typeof link !== 'string') {
            return res.status(400).json({ message: 'Missing or invalid subscription link' });
        }

        let subscriptionUrl;
        try {
            subscriptionUrl = new URL(link);
        } catch {
            return res.status(400).json({ message: 'Invalid URL format' });
        }

        // Fetch the iCal data with a reasonable timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        let icalContent;
        try {
            const response = await fetch(subscriptionUrl.toString(), {
                headers: { 'User-Agent': 'Canvas-Tracker/1.0' },
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!response.ok) {
                return res.status(response.status).json({
                    message: `Failed to fetch subscription: ${response.statusText}`,
                });
            }

            icalContent = await response.text();

            if (!icalContent.includes('BEGIN:VCALENDAR')) {
                return res.status(400).json({ message: 'Invalid iCalendar format' });
            }
        } catch (fetchErr) {
            clearTimeout(timeout);
            if (fetchErr.name === 'AbortError') {
                return res.status(504).json({ message: 'Subscription link request timeout' });
            }
            return res.status(502).json({ message: 'Failed to fetch subscription link' });
        }

        // Parse iCal events
        const events = parseICalEvents(icalContent);

        return res.status(200).json({
            generatedAt: new Date().toISOString(),
            totalEvents: events.length,
            events,
        });
    } catch (error) {
        console.error('Timetable parse error:', error);
        return res.status(500).json({
            message: 'Internal server error',
            error: error.message,
        });
    }
}

// Simple iCal parser
function parseICalEvents(icalContent) {
    const events = [];

    // Split by VEVENT blocks
    const eventRegex = /BEGIN:VEVENT(.*?)END:VEVENT/gs;
    let match;

    while ((match = eventRegex.exec(icalContent)) !== null) {
        const eventData = match[1];
        const event = parseEvent(eventData);
        if (event) {
            events.push(event);
        }
    }

    return events;
}

function parseEvent(eventData) {
    const event = {};

    // Parse SUMMARY
    const summaryMatch = eventData.match(/SUMMARY:(.+?)(?:\r?\n)/);
    event.summary = summaryMatch ? decodeICalText(summaryMatch[1].trim()) : 'Untitled Event';

    // Parse LOCATION
    const locationMatch = eventData.match(/LOCATION:(.+?)(?:\r?\n)/);
    event.location = locationMatch ? decodeICalText(locationMatch[1].trim()) : '';

    // Parse DESCRIPTION
    const descriptionMatch = eventData.match(/DESCRIPTION:(.+?)(?:\r?\n)/);
    event.description = descriptionMatch ? decodeICalText(descriptionMatch[1].trim()) : '';

    // Parse DTSTART (required)
    const startMatch = eventData.match(/DTSTART(?:;[^:]*)?:([^\r\n]+)/);
    if (!startMatch) return null;
    event.start = parseICalDate(startMatch[1]);
    if (!event.start) return null;

    // Parse DTEND (required)
    const endMatch = eventData.match(/DTEND(?:;[^:]*)?:([^\r\n]+)/);
    if (!endMatch) return null;
    event.end = parseICalDate(endMatch[1]);
    if (!event.end) return null;

    // Parse UID
    const uidMatch = eventData.match(/UID:(.+?)(?:\r?\n)/);
    event.uid = uidMatch ? uidMatch[1].trim() : '';

    return event;
}

function parseICalDate(dateStr) {
    // Handle both DATE (YYYYMMDD) and DATETIME (YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ) formats
    dateStr = dateStr.trim();

    if (dateStr.length === 8) {
        // DATE format: YYYYMMDD
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        return new Date(year, month, day).toISOString();
    } else if (dateStr.includes('T')) {
        // DATETIME format
        const isUtc = dateStr.endsWith('Z');
        const basePart = isUtc ? dateStr.slice(0, -1) : dateStr;

        const year = parseInt(basePart.substring(0, 4));
        const month = parseInt(basePart.substring(4, 6)) - 1;
        const day = parseInt(basePart.substring(6, 8));
        const hour = parseInt(basePart.substring(9, 11)) || 0;
        const minute = parseInt(basePart.substring(11, 13)) || 0;
        const second = parseInt(basePart.substring(13, 15)) || 0;

        if (isUtc) {
            return new Date(Date.UTC(year, month, day, hour, minute, second)).toISOString();
        } else {
            return new Date(year, month, day, hour, minute, second).toISOString();
        }
    }

    return null;
}

function decodeICalText(text) {
    return text
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\,/g, ',')
        .replace(/\\:/g, ':')
        .replace(/\\;/g, ';')
        .replace(/\\\\\\/g, '\\');
}
