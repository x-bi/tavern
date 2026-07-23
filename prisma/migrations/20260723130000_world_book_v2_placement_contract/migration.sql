-- Enforce the Context Engine V2 world-book placement contract inside active
-- revision configJson. No schema change is required; this migration removes
-- the remaining legacy values from persisted JSON.

CREATE TABLE "_world_book_invalid_after_current_guard" (
  "id" TEXT NOT NULL,
  CONSTRAINT "_world_book_invalid_after_current_guard_must_be_empty" CHECK ("id" IS NULL)
);

INSERT INTO "_world_book_invalid_after_current_guard" ("id")
SELECT "id"
FROM "WorldBookEntryRevision"
WHERE json_extract("configJson", '$.placement') IN (
  'after_current_user',
  'after_current_user_input',
  'after_current_user_message'
);

DROP TABLE "_world_book_invalid_after_current_guard";

UPDATE "WorldBookEntryRevision"
SET "configJson" = json_set("configJson", '$.placement', 'before_current_user')
WHERE json_extract("configJson", '$.placement') IN (
  'before_current_user_input',
  'before_current_user_message'
);

UPDATE "WorldBookEntryRevision"
SET "configJson" = json_set(
  "configJson",
  '$.placement',
  CASE json_extract("configJson", '$.contentType')
    WHEN 'state' THEN 'before_current_user'
    WHEN 'behavior_rule' THEN 'instruction'
    WHEN 'reference' THEN 'after_history'
    ELSE 'before_history'
  END
)
WHERE json_extract("configJson", '$.placement') IS NULL;

CREATE TABLE "_world_book_invalid_placement_guard" (
  "id" TEXT NOT NULL,
  CONSTRAINT "_world_book_invalid_placement_guard_must_be_empty" CHECK ("id" IS NULL)
);

INSERT INTO "_world_book_invalid_placement_guard" ("id")
SELECT "id"
FROM "WorldBookEntryRevision"
WHERE json_extract("configJson", '$.placement') NOT IN (
  'instruction',
  'before_history',
  'after_history',
  'before_current_user'
);

DROP TABLE "_world_book_invalid_placement_guard";
