-- Operator-only READ-ONLY inspection. No migration, grants, fencing or player data.
-- Supply all four psql variables; use a protected PGSERVICE/PGPASSFILE for login.
-- See RELEASE_PREFLIGHT.md for stage interpretation and required operator access.
\set ON_ERROR_STOP on
\pset pager off
\if :{?ledger_schema}
\else
  \echo 'Missing ledger_schema'
  SELECT 1 / 0 AS missing_ledger_schema;
\endif
\if :{?runtime_role}
\else
  \echo 'Missing runtime_role'
  SELECT 1 / 0 AS missing_runtime_role;
\endif
\if :{?migration_role}
\else
  \echo 'Missing migration_role'
  SELECT 1 / 0 AS missing_migration_role;
\endif
\if :{?legacy_roles_json}
\else
  \echo 'Missing legacy_roles_json (JSON array of EVERY retiring writer role)'
  SELECT 1 / 0 AS missing_legacy_roles_json;
\endif

BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';

-- The transaction is deliberately read-only; default_read_only/recovery describe
-- the endpoint. These do not prove a successful future application commit.
SELECT current_database() AS database, current_user AS inspection_role,
       version() AS database_version, current_schema() AS resolved_schema,
       current_schema() = :'ledger_schema' AS correct_search_path,
       current_setting('default_transaction_read_only') AS default_read_only,
       pg_is_in_recovery() AS replica,
       current_setting('transaction_read_only') AS inspection_is_read_only,
       r.rolsuper OR pg_has_role(current_user, 'pg_read_all_stats', 'USAGE')
         AS full_activity_visibility
FROM pg_roles r WHERE r.rolname = current_user;

SELECT r.rolname, r.rolcanlogin, r.rolsuper, r.rolcreatedb, r.rolcreaterole,
       r.rolreplication, r.rolbypassrls,
       ARRAY(SELECT setting FROM unnest(r.rolconfig) setting
         WHERE setting LIKE 'statement_timeout=%' OR setting LIKE 'search_path=%') AS reviewed_settings,
       has_database_privilege(r.oid, current_database(), 'CONNECT') AS can_connect,
       has_schema_privilege(r.oid, n.oid, 'USAGE') AS schema_usage,
       has_schema_privilege(r.oid, n.oid, 'CREATE') AS schema_create
FROM pg_roles r LEFT JOIN pg_namespace n ON n.nspname = :'ledger_schema'
WHERE r.rolname IN (:'runtime_role', :'migration_role')
ORDER BY r.rolname;

-- MEMBER also exposes owner/admin escalation paths requiring operator review;
-- inspect memberships even when NOINHERIT suppresses currently effective grants.
SELECT member.rolname AS login_role, parent.rolname AS member_of,
       pg_has_role(member.oid, parent.oid, 'USAGE') AS currently_effective,
       parent.rolsuper, parent.rolcreaterole, parent.rolcreatedb, parent.rolbypassrls
FROM pg_roles member CROSS JOIN pg_roles parent
WHERE member.rolname IN (:'runtime_role', :'migration_role')
  AND member.oid <> parent.oid AND pg_has_role(member.oid, parent.oid, 'MEMBER')
ORDER BY 1, 2;

WITH required(name) AS (VALUES ('planetfall_guest_profiles'),
  ('planetfall_profile_operations'), ('planetfall_account_links'))
SELECT required.name, t.oid IS NOT NULL AS present, n.nspname,
       t.relkind = 'r' AND t.relpersistence = 'p' AS durable_ordinary_table,
       t.relrowsecurity, pg_get_userbyid(t.relowner) AS owner,
       pg_has_role(m.oid, t.relowner, 'USAGE') AS migration_effective_owner,
       pg_has_role(r.oid, t.relowner, 'MEMBER') AS runtime_owner_path,
       has_table_privilege(r.oid, t.oid, 'DELETE') AS runtime_delete,
       has_table_privilege(r.oid, t.oid, 'TRUNCATE') AS runtime_truncate,
       has_table_privilege(r.oid, t.oid, 'TRIGGER') AS runtime_trigger,
       has_table_privilege(r.oid, t.oid, 'REFERENCES') AS runtime_references
FROM required
LEFT JOIN pg_class t ON t.oid = to_regclass(format('%I.%I', :'ledger_schema', required.name))
LEFT JOIN pg_namespace n ON n.oid = t.relnamespace
LEFT JOIN pg_roles r ON r.rolname = :'runtime_role'
LEFT JOIN pg_roles m ON m.rolname = :'migration_role'
ORDER BY required.name;

-- Each row must report shape_ok and required_grants_ok. Any extra write column
-- is reported below. Match the application contract, not just table existence.
WITH required(tab, col, typ, nn, def, access) AS (VALUES
 ('planetfall_guest_profiles','id','text',true,NULL::text,'si'),
 ('planetfall_guest_profiles','progress','jsonb',true,NULL,'siu'),
 ('planetfall_guest_profiles','leaderboard_name','text',false,NULL,'su'),
 ('planetfall_profile_operations','id','uuid',true,NULL,'si'),
 ('planetfall_profile_operations','profile_key','text',true,NULL,'si'),
 ('planetfall_profile_operations','result','jsonb',true,NULL,'si'),
 ('planetfall_account_links','issuer','text',true,NULL,'si'),
 ('planetfall_account_links','auth_user_id','text',true,NULL,'si'),
 ('planetfall_account_links','profile_key','text',true,NULL,'si'),
 ('planetfall_account_links','linked_at','timestamp with time zone',true,'now()',''),
 ('planetfall_account_links','preferences','jsonb',false,NULL,'su'),
 ('planetfall_account_links','preferences_revision','integer',true,'0','su'))
SELECT q.tab, q.col, format_type(a.atttypid,a.atttypmod) AS actual_type,
       a.attnotnull, pg_get_expr(d.adbin,d.adrelid,true) AS actual_default,
       COALESCE(a.attnum IS NOT NULL AND format_type(a.atttypid,a.atttypmod) = q.typ
         AND a.attnotnull = q.nn
         AND pg_get_expr(d.adbin,d.adrelid,true) IS NOT DISTINCT FROM q.def, false) AS shape_ok,
       COALESCE((position('s' IN q.access)=0 OR has_column_privilege(r.oid,t.oid,a.attnum,'SELECT'))
         AND (position('i' IN q.access)=0 OR has_column_privilege(r.oid,t.oid,a.attnum,'INSERT'))
         AND (position('u' IN q.access)=0 OR has_column_privilege(r.oid,t.oid,a.attnum,'UPDATE'))
         AND a.attnum IS NOT NULL AND r.oid IS NOT NULL, false) AS required_grants_ok
FROM required q
LEFT JOIN pg_class t ON t.oid = to_regclass(format('%I.%I', :'ledger_schema', q.tab))
LEFT JOIN pg_attribute a ON a.attrelid=t.oid AND a.attname=q.col AND a.attnum>0 AND NOT a.attisdropped
LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
LEFT JOIN pg_roles r ON r.rolname=:'runtime_role'
ORDER BY q.tab,q.col;

WITH actual AS (
 SELECT t.oid, t.relname AS tab, a.attnum, a.attname AS col,
        has_column_privilege(r.oid,t.oid,a.attnum,'INSERT') AS ins,
        has_column_privilege(r.oid,t.oid,a.attnum,'UPDATE') AS upd
 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace
 JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped
 JOIN pg_roles r ON r.rolname=:'runtime_role'
 WHERE n.nspname=:'ledger_schema' AND t.relname IN
   ('planetfall_guest_profiles','planetfall_profile_operations','planetfall_account_links'))
SELECT tab,col,ins,upd FROM actual
WHERE (ins AND NOT ((tab='planetfall_guest_profiles' AND col IN ('id','progress'))
 OR (tab='planetfall_profile_operations' AND col IN ('id','profile_key','result'))
 OR (tab='planetfall_account_links' AND col IN ('issuer','auth_user_id','profile_key'))))
 OR (upd AND NOT ((tab='planetfall_guest_profiles' AND col IN ('progress','leaderboard_name'))
 OR (tab='planetfall_account_links' AND col IN ('preferences','preferences_revision'))))
ORDER BY tab,col;

-- Compare all required constraints with profile-schema.ts. Constraints must be
-- validated, nondeferrable; their backing indexes must be valid/ready/live.
SELECT t.relname, c.contype, pg_get_constraintdef(c.oid,true) AS definition,
       c.convalidated, c.condeferrable,
       CASE WHEN c.contype IN ('p','u','f')
         THEN i.indisvalid AND i.indisready AND i.indislive ELSE true END AS index_usable
FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace
JOIN pg_constraint c ON c.conrelid=t.oid
LEFT JOIN pg_index i ON i.indexrelid=c.conindid
WHERE n.nspname=:'ledger_schema' AND t.relname IN
 ('planetfall_guest_profiles','planetfall_profile_operations','planetfall_account_links')
ORDER BY t.relname,c.contype,c.conname;

SELECT x.oid IS NOT NULL AS present, pg_get_indexdef(x.oid) AS definition,
       t.relname AS indexed_table,
       i.indisvalid AND i.indisready AND i.indislive AND NOT i.indisunique AS usable,
       pg_get_indexdef(x.oid) LIKE
         '% USING btree ((((progress ->> ''sessionTotalXp''::text))::bigint) DESC, id COLLATE "C") WHERE (leaderboard_name IS NOT NULL)'
         AS matches_application_order
FROM (SELECT to_regclass(format('%I.planetfall_leaderboard_rank_idx', :'ledger_schema')) AS oid) x
LEFT JOIN pg_index i ON i.indexrelid=x.oid LEFT JOIN pg_class t ON t.oid=i.indrelid;

-- Fence checkpoint: every retiring role must exist, be NOLOGIN, have no owner
-- path/admin capability/effective writes, and have zero sessions/prepared work.
-- A false fence is expected BEFORE maintenance; it blocks AFTER fencing.
SELECT jsonb_array_length(:'legacy_roles_json'::jsonb) > 0 AS nonempty_writer_inventory;
WITH legacy(name) AS (SELECT jsonb_array_elements_text(:'legacy_roles_json'::jsonb))
SELECT l.name, r.oid IS NOT NULL AS role_exists, r.rolcanlogin,
       r.rolsuper, r.rolcreaterole, r.rolcreatedb, r.rolbypassrls,
       has_schema_privilege(r.oid,n.oid,'CREATE') AS schema_create,
       (SELECT count(*) FROM pg_stat_activity a
         WHERE a.datname=current_database() AND a.usename=l.name) AS sessions,
       (SELECT count(*) FROM pg_prepared_xacts p
         WHERE p.database=current_database() AND p.owner=l.name) AS prepared
FROM legacy l LEFT JOIN pg_roles r ON r.rolname=l.name
LEFT JOIN pg_namespace n ON n.nspname=:'ledger_schema' ORDER BY l.name;

WITH legacy(name) AS (SELECT jsonb_array_elements_text(:'legacy_roles_json'::jsonb))
SELECT l.name, t.relname, pg_has_role(r.oid,t.relowner,'MEMBER') AS owner_path,
       has_table_privilege(r.oid,t.oid,'DELETE') AS can_delete,
       has_table_privilege(r.oid,t.oid,'TRUNCATE') AS can_truncate,
       has_table_privilege(r.oid,t.oid,'TRIGGER') AS can_trigger,
       has_table_privilege(r.oid,t.oid,'REFERENCES') AS can_reference,
       bool_or(has_column_privilege(r.oid,t.oid,a.attnum,'INSERT')) AS can_insert,
       bool_or(has_column_privilege(r.oid,t.oid,a.attnum,'UPDATE')) AS can_update
FROM legacy l LEFT JOIN pg_roles r ON r.rolname=l.name
JOIN pg_namespace n ON n.nspname=:'ledger_schema'
JOIN pg_class t ON t.relnamespace=n.oid AND t.relname IN
 ('planetfall_guest_profiles','planetfall_profile_operations','planetfall_account_links')
JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped
GROUP BY l.name,r.oid,t.oid ORDER BY l.name,t.relname;

-- Any unresolved prepared transaction in this database requires review, including
-- an unknown owner. Do not print query text, profile rows, tokens or auth IDs.
SELECT owner,count(*) AS prepared_transactions FROM pg_prepared_xacts
WHERE database=current_database() GROUP BY owner;
SELECT usename,application_name,backend_type,state,count(*) AS sessions,
       min(xact_start) AS oldest_transaction
FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()
GROUP BY usename,application_name,backend_type,state ORDER BY usename,application_name;

ROLLBACK;
\echo 'Inspection complete; exit 0 means SQL ran, NOT that release gates passed. Review every result.'
