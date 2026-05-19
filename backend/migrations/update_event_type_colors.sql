-- Update event type colors to CougarAI / UH brand palette
UPDATE event_types SET color = '#991b1b' WHERE lower(name) = 'workshops';
UPDATE event_types SET color = '#7f1d1d' WHERE lower(name) = 'general meetings';
UPDATE event_types SET color = '#dc2626' WHERE lower(name) = 'socials';
UPDATE event_types SET color = '#b91c1c' WHERE lower(name) = 'hackathons';
UPDATE event_types SET color = '#6b2020' WHERE lower(name) = 'other';
