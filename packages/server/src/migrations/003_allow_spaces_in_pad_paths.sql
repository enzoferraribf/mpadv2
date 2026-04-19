ALTER TABLE pads DROP CONSTRAINT IF EXISTS pads_path_check;
ALTER TABLE pads
ADD CONSTRAINT pads_path_check
CHECK (path <> '/' AND path NOT LIKE '%//%' AND path ~ '^/.+$');

ALTER TABLE pads DROP CONSTRAINT IF EXISTS pads_parent_path_check;
ALTER TABLE pads
ADD CONSTRAINT pads_parent_path_check
CHECK (
    parent_path IS NULL
    OR (
        parent_path <> path
        AND parent_path <> '/'
        AND parent_path NOT LIKE '%//%'
        AND parent_path ~ '^/.+$'
    )
);
