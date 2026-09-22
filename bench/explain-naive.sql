PREPARE nearby_first(float8, float8, float8, int) AS
SELECT "id", (
  6371 * acos(LEAST(1, GREATEST(-1,
    cos(radians($1)) * cos(radians("lat")) *
    cos(radians("lng") - radians($2)) +
    sin(radians($1)) * sin(radians("lat"))
  )))
) AS "distanceKm"
FROM "TripPost"
WHERE "deletedAt" IS NULL
  AND (
  6371 * acos(LEAST(1, GREATEST(-1,
    cos(radians($1)) * cos(radians("lat")) *
    cos(radians("lng") - radians($2)) +
    sin(radians($1)) * sin(radians("lat"))
  )))
) <= $3
ORDER BY "distanceKm" ASC, "id" ASC
LIMIT $4;

PREPARE nearby_next(float8, float8, float8, int, float8, int) AS
SELECT "id", (
  6371 * acos(LEAST(1, GREATEST(-1,
    cos(radians($1)) * cos(radians("lat")) *
    cos(radians("lng") - radians($2)) +
    sin(radians($1)) * sin(radians("lat"))
  )))
) AS "distanceKm"
FROM "TripPost"
WHERE "deletedAt" IS NULL
  AND (
  6371 * acos(LEAST(1, GREATEST(-1,
    cos(radians($1)) * cos(radians("lat")) *
    cos(radians("lng") - radians($2)) +
    sin(radians($1)) * sin(radians("lat"))
  )))
) <= $3
  AND ((
  6371 * acos(LEAST(1, GREATEST(-1,
    cos(radians($1)) * cos(radians("lat")) *
    cos(radians("lng") - radians($2)) +
    sin(radians($1)) * sin(radians("lat"))
  )))
), "id") > ($5, $6)
ORDER BY "distanceKm" ASC, "id" ASC
LIMIT $4;

EXPLAIN (ANALYZE, BUFFERS) EXECUTE nearby_first(37.5665, 126.978, 5, 21);
EXPLAIN (ANALYZE, BUFFERS) EXECUTE nearby_next(37.5665, 126.978, 5, 21, 0.9998344284729207, 957465);
