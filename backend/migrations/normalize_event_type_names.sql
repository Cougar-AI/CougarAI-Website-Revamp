-- Normalize legacy singular event type names to match canonical event_types.name values.
-- Safe to re-run (rows already matching are untouched by WHERE clauses).

UPDATE events SET event_type = 'Socials'         WHERE event_type = 'Social';
UPDATE events SET event_type = 'Workshops'        WHERE event_type = 'Workshop';
UPDATE events SET event_type = 'Hackathons'       WHERE event_type = 'Hackathon';
UPDATE events SET event_type = 'General Meetings' WHERE event_type IN ('Meeting', 'General Meeting', 'Meetings');
UPDATE events SET event_type = 'Other'            WHERE event_type IN ('other', 'Others');
