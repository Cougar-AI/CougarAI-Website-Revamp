-- Deduplicate sponsors: keep the row with the lowest sponsor_id for each name
DELETE FROM sponsors s1
USING sponsors s2
WHERE s1.name = s2.name
  AND s1.sponsor_id > s2.sponsor_id;

-- Enforce uniqueness going forward (idempotent via index)
CREATE UNIQUE INDEX IF NOT EXISTS unique_sponsor_name ON sponsors (name);
