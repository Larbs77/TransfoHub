-- Preserve existing role grants while moving the portfolio Gantt to /gantt.
UPDATE "AppRole"
SET "pages" = (
  SELECT jsonb_agg(
    CASE
      WHEN page = '/jalons/gantt' THEN to_jsonb('/gantt'::text)
      ELSE to_jsonb(page)
    END
  )
  FROM jsonb_array_elements_text("AppRole"."pages"::jsonb) AS page
)
WHERE "pages"::jsonb ? '/jalons/gantt';
