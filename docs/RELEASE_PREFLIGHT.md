# Final production release preflight

This is an operator plan, not deployment approval. Pair it with
[the cutover/rollback runbook](RELEASE_CUTOVER.md),
[the schema and grants](PLAYER_PROFILES.md#explicit-migration-and-database-roles),
and [the build contracts](DEPLOYMENT.md). Do not run the privileged cutover
commands until the operator separately approves maintenance, fencing, backup,
migration and deployment. Local rehearsal cannot verify actual hosted grants.

## Candidate approval record

Approve the **complete source manifest**, its source archive SHA-256, lockfile,
Node/npm versions, schema-module hashes, compiled artifacts and build inputs.
The current base is `885a0f01f0c76e684300935a04abefce4a6e12d0`, branch
`codex/secure-accounts`; HEAD by itself omits required fixes. The Phase 4.5
evidence package inventories tracked modifications and required untracked files
separately. Do not include the thousands of unrelated `artifacts/` paths,
private environment files, data directories, local agent configuration,
node_modules or diagnostic output in the release commit.

After separate source-control authorization, use the exact manifest path list
to review and stage only approved files. Review the staged diff and the final
tree, then create a proposed stabilization commit and annotated release tag
such as `release/transactional-preflight-20261119`. Neither has been created by
this task. Check the tag is unused before creating it. Record the actual commit
and tag object IDs. Git line-ending normalization can change source bytes:
compare the materialized commit against the approved manifest and build/test
any changed runtime inputs again. Never claim the dirty working-tree package
already has the identity of a future commit.

Build from a fresh extraction or approved immutable commit, with `npm ci` and
the lockfile; record tool versions and every artifact checksum. The tested
toolchain is Node 22.23.3/npm 10.9.9. `render.yaml` currently pins Node 22.22.0;
approve a consistent toolchain or rerun the final assembly checks under that
exact hosted version before cutover. No host setting was changed here.

Use one source identity for shared contracts, server, client and Pages Functions.
The reproducible local client build uses a loopback `VITE_SERVER_URL` and is
**not a deployable hosted-origin bundle**. The operator must bake the intended
Render HTTPS origin into the final Pages build and record its new artifact hash.
Do the same for the approved rollback client. Preserve the canonical Pages
origin, Auth issuer and account mappings. Keep one authoritative room/presence
server; corrected persistence supports overlapping writers, not shared rooms.

The reconstructed Phase 4.2 rollback build tested in Phase 4.4 contains the
transactional writer and restricted read-only startup. Its provenance and
artifact SHA are retained in the evidence package. It is not a committed or
operator-approved rollback revision. Approve that exact retained artifact and
its matching source/build inputs, or freeze and validate an immutable corrected
rollback revision before release. Base HEAD is an unsafe rollback target.

## Read-only Neon inspection

An authorized operator must identify the actual Neon project, branch, database,
schema, direct and pooler endpoints, every writer role, and the Render/Pages
projects. Keep credentials in protected service/password files or secret stores;
never paste them into logs, this document or shell history.

Run [PRODUCTION_PREFLIGHT.sql](PRODUCTION_PREFLIGHT.sql) on the verified endpoint
using psql, supplying `ledger_schema`, `runtime_role`, `migration_role` and
`legacy_roles_json` (a nonempty JSON array of **all** retiring writer roles).
For example, with a protected service named `planetfall-inspection`:

```sh
psql -X service=planetfall-inspection -v ledger_schema=public \
  -v runtime_role=planetfall_runtime -v migration_role=planetfall_migration \
  -v 'legacy_roles_json=["planetfall_legacy"]' \
  -f docs/PRODUCTION_PREFLIGHT.sql
```

The SQL uses a read-only transaction, five-second statement timeout and rollback.
It does not alter schema, grants, roles, sessions or player rows. Exit zero only
means execution succeeded. Preserve output securely and review every result;
there is no automatic deployment approval. The privileged inspection login must
see full activity across all writers (administrator or `pg_read_all_stats` where
supported). Otherwise zero visible sessions is inconclusive. Catalog checks of
other roles and ownership require adequate inspection rights; failure is a stop
condition, not a reason to assume permissions are correct. Run a fresh runtime
connection separately to confirm its resolved schema and effective startup
permissions. Do not grant the runtime activity-monitoring rights for this check.

Before maintenance, missing additive objects or an active legacy role may be
expected: record the pending work. **After fencing**, legacy roles must be
NOLOGIN, have zero sessions and unresolved prepared transactions, no effective
column writes, no owner/admin escalation path and no schema CREATE. Also review
inherited role memberships for each legacy login with the same membership query
used for the runtime login. Include all effective owner/admin roles in the
fence inventory. Any unrecognized writer connection requires investigation.

After the separately authorized migration, all three permanent ordinary tables
must exist in the intended current schema with RLS disabled. All 12 required
column shapes/defaults and required column grants must pass. Required constraints
are: profile and receipt primary key `(id)`; account primary key
`(issuer, auth_user_id)` and unique `(profile_key)`; both profile-key foreign keys;
publication-name format/trim check; preferences size check. Compare the exact
definitions with `server/src/profile-schema.ts`; require validated,
nondeferrable constraints with usable backing indexes. The partial lifetime-XP
ranking index must be valid, ready, live, nonunique, on the profile table, ordered
by numeric `sessionTotalXp DESC, id COLLATE "C" ASC`, for public names only.

Runtime must have LOGIN, CONNECT, schema USAGE and the documented minimum column
grants; no table ownership, owner/admin membership, schema CREATE, DELETE,
TRUNCATE, TRIGGER, REFERENCES, extra INSERT or extra UPDATE. The unexpected-write
query must return zero rows. Confirm the fresh runtime session uses the intended
statement timeout. Migration credentials need schema USAGE/CREATE and effective
ownership of target tables (plus REFERENCES when needed), only in the operator
environment. Runtime must never receive the migration URL.

There is no integer schema-version table. Identify the migration set by hashes
of `profile-schema.ts`, `profile-migrations.ts` and `migrate-profile-database.ts`.
Do not create fake historical XP or modify receipts. Keep managed Auth recovery
and the issuer mapping with the backup plan. The local PostgreSQL 17 rehearsal
does not verify the hosted Neon version or provider-specific role restrictions.

## Mandatory fence checkpoint

Use the privileged actions in RELEASE_CUTOVER only after approval. Record each
check, timestamp and responsible operator before permitting a corrected write:

1. Disable automatic replacement and close admission at the actual server ingress.
   Finish or deliberately end rooms. A Pages notice does not stop live sockets.
2. Drain pending saves, inspect exit status and confirm every old service, worker,
   manual process and scheduler is stopped in the hosting/process inventory.
   The shutdown deadline is five seconds. Record unconfirmed saves separately.
3. Retire each old login. Terminate its existing sessions, including idle poolers
   and open transactions. Resolve prepared transactions with the database owner.
   NOLOGIN or password rotation alone cannot stop an existing transaction.
4. Transfer intended ledger ownership to the approved migration role and remove
   old effective table/column writes, PUBLIC/inherited access and owner/admin
   escalation. Never reuse the retired credential for corrected runtime.
5. Repeat read-only session/privilege checks on the actual database; require zero
   legacy sessions and zero unresolved prepared transactions. Independently test
   failed old authentication at **every direct and pooled endpoint used**. Check
   that no deployment, worker or secret configuration can restart an old writer.
6. Record a final fenced backup checksum and a tested isolated restore before
   migration. Restore ownership explicitly. Only the approved corrected builds
   may receive the fresh restricted runtime credential.

Abort with maintenance still active if any writer, credential, session, prepared
transaction or escalation path is unknown or cannot be excluded. Do not infer
the fence from HTTP silence, shutdown messages, a signal request or NOLOGIN alone.
Provider-managed owner roles that cannot be fenced require a separately verified
operator procedure. No fencing has been executed in this phase.

## Bounded hosted acceptance

Allocate 30 minutes after corrected startup, using two authorized disposable
test identities, with the operator ready to keep maintenance active. Record
versions, exact observed balances and commit-confirmed replies. Do not inject
scores or test crashes against real player records. Allow up to 60 seconds per
healthy startup/reconnect step after the host is awake; failure keeps traffic
closed. Observe five minutes of logs after functional checks.

| Check | Expected result | Failure action |
| --- | --- | --- |
| Artifact/config identity | Approved server, matching client/Functions, correct baked server origin; one room authority | Abort; correct version/config before admission |
| Health and catalog | `/health` 200, `ok:true`, `profileStorage:"postgresql"`; approved schema/grants; no legacy sessions | Abort; do not fall back to file/memory |
| Transport | Authorized Pages origin connects over WebSocket; unlisted origin rejected | Abort on permissive CORS or failed intended transport |
| Guests and rooms | Two distinct profiles load; create/join/ready/start a short match | Abort on identity leak, duplicates or failed room entry |
| Gameplay and results | Move/aim/fire/use an ability; representative round completes with expected authoritative rewards | Abort on gameplay/protocol failure |
| Durable progression | Record XP/Fallbucks before/after earned match; wait for committed profile update; refresh and rejoin preserve exact totals | Abort on loss, duplicate reward or unconfirmed save |
| Shop | Buy affordable unowned item once; balance and ownership commit together; equip persists after reload | Abort on missing purchase, double charge or unauthorized mutation |
| Planet Pass | Correct tier/unlock state for earned XP; eligible claim survives reload; no duplicate grant | Abort on incorrect durable state; do not fabricate XP to force a tier |
| Account | Where configured, complete real sign-in/cancel; canonical linked progress/preferences survive reload; stale guest cannot mutate account | Abort on authentication/ownership/privacy failure |
| Leaderboard | Test profile opts in with valid public name, appears at correct authoritative rank when applicable; opt-out removes it within cache window | Pause reopening to inspect; no exposure of private identities |
| Presence | Two unique identities count as two, duplicate verified tab adds zero; mode/room switch adds zero; disconnect expires per configured grace | Keep release paused on inaccurate/ghost counts |
| Restart | After confirmed save/drain, replace corrected server; explicitly reload clients; exact profiles/ownership/pass/visibility return, rooms can be recreated | Abort to corrected rollback on data/protocol regression |
| Logs/DB | Five minutes without save failures, repeated crashes, schema errors, unknown writers or unhealthy connection growth | Abort if durable writes/readiness fail; investigate before retry |

Use the actual cache/grace constants in the approved source to set observation
windows: leaderboard server cache is 20 seconds and an open board refreshes every
30 seconds (allow 55 seconds for a remote change); presence broadcasts are
coalesced at one second. A closed socket is removed immediately; an interrupted
transport can remain counted until Socket.IO detects it (10-second ping interval,
20-second timeout; allow 35 seconds). Do not assume instantaneous leaderboard
invalidation on other processes.
If an eligible Pass reward is unavailable in the authorized test profile, mark
that hosted check pending rather than synthesizing progression. All required
acceptance checks must be resolved before opening normal traffic.

## Failure decisions and rollback

Migration failure, wrong grants, active legacy writers, failed readiness,
client/server mismatch, progression failure and repeated crashes all require
maintenance to remain active. Inspect the transaction outcome before retrying
the explicit migration; do not delete incompatible objects or run startup DDL.
Temporary leaderboard/presence failures may be diagnosed without restarting
healthy writers, but leave release acceptance incomplete. Monitor only isolated
transient latency that recovers within the observation window with confirmed
saves and no recurrence; a missing ranking is not proof of lost progression.

For database unavailability, stop admission and keep the current process alive
while queued rewards retry. Do not kill it to clear an error: uncommitted rewards
in memory may be lost. Inspect drain outcome before any necessary stop. Never
claim this known loss window has been fixed.

Rollback means the approved **corrected** server plus compatible client/Functions
and restricted login, retaining additive schema, all operation receipts, account
links, preferences and newer committed progress. Keep legacy credentials fenced.
Use the rollback steps in RELEASE_CUTOVER and repeat durable-save/reload checks.
If the rollback build fails, retain maintenance; use a verified corrected build
after diagnosis. Do not restore an older backup over newer valid writes without
an explicit recovery/reconciliation decision.

Graceful replacement explicitly disconnects clients; they currently require a
reload even if the UI says Reconnecting. Active rooms end on replacement. A new
Pages deployment does not update already loaded clients. Announce reload and
temporary unavailability. Abrupt transport loss can reconnect automatically;
it does not guarantee in-memory rewards or rooms survive a server restart.

## Remaining operator approvals

Approve immutable candidate and corrected rollback identities; match the hosted
toolchain/build inputs; verify actual Neon roles, backup/restore and every legacy
writer fence; authorize maintenance/migration; verify Render/Pages/real OAuth;
complete the bounded hosted acceptance. Until those conditions are met, the
release decision is **CONDITIONALLY READY**, not authorized for production.
