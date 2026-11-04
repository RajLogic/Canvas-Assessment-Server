import { getAuthUser } from '../../lib/middleware.js';
import { safeHttpsGet, UnsafeUrlError } from '../../lib/safe-fetch.js';

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');

    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

    try {
        const user = await getAuthUser(req);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized', redirect: '/login' });
        }

        if (!user.timetableLink) {
            return res.status(400).json({
                message: 'No timetable link configured. Add your iCal subscription URL in Settings.',
                requiresSetup: true,
            });
        }

        let icalContent;
        try {
            const response = await safeHttpsGet(user.timetableLink, {
                headers: { 'User-Agent': 'Canvas-Tracker/1.0' },
            });

            if (response.redirected) {
                return res.status(502).json({
                    message: 'Your timetable link redirects to another address. Save the final https:// address in Settings.',
                });
            }

            if (response.status < 200 || response.status >= 300) {
                return res.status(502).json({ message: 'Failed to fetch timetable subscription link.' });
            }

            icalContent = response.body;

            if (!icalContent.includes('BEGIN:VCALENDAR')) {
                return res.status(400).json({ message: 'Invalid iCalendar format at the provided URL.' });
            }
        } catch (fetchErr) {
            if (fetchErr instanceof UnsafeUrlError) {
                return res.status(400).json({ message: `Timetable link not allowed: ${fetchErr.message}` });
            }
            if (fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError') {
                return res.status(504).json({ message: 'Timetable subscription request timed out.' });
            }
            return res.status(502).json({ message: 'Failed to fetch timetable subscription link.' });
        }

        const events = parseICalEvents(icalContent);

        return res.status(200).json({
            generatedAt: new Date().toISOString(),
            totalEvents: events.length,
            events,
        });
    } catch (error) {
        console.error('Timetable parse error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

function parseICalEvents(icalContent) {
    const events = [];
    const eventRegex = /BEGIN:VEVENT(.*?)END:VEVENT/gs;
    let match;
    while ((match = eventRegex.exec(icalContent)) !== null) {
        const event = parseEvent(match[1]);
        if (event) events.push(event);
    }
    return events;
}

function parseEvent(eventData) {
    const event = {};

    const summaryValue = extractICalField(eventData, 'SUMMARY');
    event.summary = summaryValue ? decodeICalText(summaryValue.trim()) : 'Untitled Event';
    event.className = getClassNameFromSummary(event.summary);

    const locationValue = extractICalField(eventData, 'LOCATION');
    event.location = locationValue ? decodeICalText(locationValue.trim()) : '';

    const descriptionValue = extractICalField(eventData, 'DESCRIPTION');
    event.description = descriptionValue ? decodeICalText(descriptionValue.trim()) : '';

    const startMatch = eventData.match(/DTSTART(?:;[^:]*)?:([^\r\n]+)/);
    if (!startMatch) return null;
    event.start = parseICalDate(startMatch[1]);
    if (!event.start) return null;

    const endMatch = eventData.match(/DTEND(?:;[^:]*)?:([^\r\n]+)/);
    if (!endMatch) return null;
    event.end = parseICalDate(endMatch[1]);
    if (!event.end) return null;

    const uidMatch = eventData.match(/UID:(.+?)(?:\r?\n)/);
    event.uid = uidMatch ? uidMatch[1].trim() : '';

    return event;
}

function extractICalField(eventData, fieldName) {
    const escapedField = fieldName.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const pattern = new RegExp(String.raw`^${escapedField}(?:;[^:\r\n]*)?:(.*(?:\r?\n[ \t].*)*)`, 'mi');
    const match = eventData.match(pattern);
    if (!match) return '';
    return match[1].replace(/\r?\n[ \t]/g, '');
}

function getClassNameFromSummary(summary) {
    return (summary || 'Untitled Event').split(',')[0].trim();
}

function parseICalDate(dateStr) {
    dateStr = dateStr.trim();
    if (dateStr.length === 8) {
        const year = Number.parseInt(dateStr.substring(0, 4));
        const month = Number.parseInt(dateStr.substring(4, 6)) - 1;
        const day = Number.parseInt(dateStr.substring(6, 8));
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else if (dateStr.includes('T')) {
        const isUtc = dateStr.endsWith('Z');
        const basePart = isUtc ? dateStr.slice(0, -1) : dateStr;
        const year = Number.parseInt(basePart.substring(0, 4));
        const month = Number.parseInt(basePart.substring(4, 6)) - 1;
        const day = Number.parseInt(basePart.substring(6, 8));
        const hour = Number.parseInt(basePart.substring(9, 11)) || 0;
        const minute = Number.parseInt(basePart.substring(11, 13)) || 0;
        const second = Number.parseInt(basePart.substring(13, 15)) || 0;
        if (isUtc) return new Date(Date.UTC(year, month, day, hour, minute, second)).toISOString();
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
    }
    return null;
}

function decodeICalText(text) {
    return text.replaceAll(String.raw`\n`, '\n').replaceAll(String.raw`\r`, '\r').replaceAll(String.raw`\,`, ',').replaceAll(String.raw`\:`, ':').replaceAll(String.raw`\;`, ';').replaceAll('\\\\\\', '\\');
}