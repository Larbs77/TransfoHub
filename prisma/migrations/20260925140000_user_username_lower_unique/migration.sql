-- Case-insensitive uniqueness for login. Fails if Admin/admin-style duplicates exist.

DO $$
DECLARE
  dupes text;
BEGIN
  SELECT string_agg(lower_name || ' (' || cnt || ')', ', ')
  INTO dupes
  FROM (
    SELECT LOWER("username") AS lower_name, COUNT(*)::int AS cnt
    FROM "User"
    GROUP BY LOWER("username")
    HAVING COUNT(*) > 1
  ) d;

  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION
      'Impossible de créer l''unicité insensible à la casse : doublons %',
      dupes;
  END IF;
END $$;

CREATE UNIQUE INDEX "User_username_lower_key" ON "User" (LOWER("username"));
