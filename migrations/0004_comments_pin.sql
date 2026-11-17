-- Comment pinning: owner-pinned comments shown above the rest.
ALTER TABLE comments ADD COLUMN is_pinned integer NOT NULL DEFAULT 0;