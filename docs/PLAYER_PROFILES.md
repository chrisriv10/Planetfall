# Saved progression and optional accounts

Fallbucks previously belonged only to a room's in-memory player record. They
survived a rematch, but leaving the room discarded that wallet. All four game
families now share a server-owned ledger for currency, crowns, XP, Planet Pass,
owned cosmetics and equipment.

The client stores only a random bearer token under `planetfall:profile-token`.
Balances are never accepted from browser storage or client payloads. Profile
tokens are sent only to their owning connection; the database stores token hashes.
Changing the display name does not change the wallet. Another player using the
same name cannot claim it. Clearing site storage or using another browser starts
a different guest profile unless you linked the original to a Google account.

## Account ownership and guest linking

Google sign-in uses [Neon Managed Better Auth](https://neon.com/docs/auth/overview). Neon manages the `neon_auth` schema. Planetfall's `planetfall_account_links` table maps the configured Neon branch issuer and verified user ID to one row in `planetfall_guest_profiles`. Its primary key and unique foreign key enforce one-to-one ownership. Account ownership depends on the verified provider ID, independently of email and pilot display name.

- First sign-in can link the exact guest ledger after the server verifies both the Google session and the browser's guest credential. The database saves pending progress before creating the link. Unclaimed guest tokens keep working. Once linked, the original guest token can no longer access that ledger.
- If the Google account already owns a profile and this device also holds guest progress, the browser offers a choice. Choosing the account preserves the guest ledger and token for later play. Choosing guest signs out of the account and resumes the guest ledger. Balances and rewards stay separate.
- Shop purchases, owned and equipped cosmetics, calling cards, emblems, weapon finishes, XP, Crowns, Fallbucks and Planet Pass stay in the same ledger across Planetfall, PlanetRoyale, PlanetRun and PlanetGun.
- Signing out revokes the current managed session, leaves its active rooms and clears the private UI before reconnecting as a guest. Switching accounts leaves the current room first and opens Google account selection. Room reconnects require the original pilot profile.
- The browser holds the existing guest bearer locally, managed auth in a first-party HTTP-only cookie and a one-use game connection ticket in memory. Tickets expire after 15 seconds. The server rechecks active accounts every 30 seconds and rejects socket packets past known session expiry. Account API responses are private and uncached.
- Account names and optional avatars appear in the signed-in browser's Account UI. The Planetfall ledger stores no provider email, OAuth tokens, passwords or avatar URLs. Account deletion and unlinking require a separate coordinated identity and data-management flow.

## Account preferences

Account sign-in syncs mouse and controller sensitivity, inverted Y, camera shake, custom bindings, preferred PlanetGun mode, five Combat Kits and hero/operator preferences. Equipped cosmetics continue through the server-authoritative ledger. Graphics, render resolution, performance and audio settings stay device-local.

When a guest profile is linked for the first time, its valid device preferences seed the account. Writes require the same authenticated session context and the revision the device loaded. If another device has already saved a newer revision, the stale write is rejected and the browser loads the newer document with a notice. Signing out restores the device's saved guest settings. Preference writes cannot modify wallets, rewards or cosmetic ownership.

## Global leaderboard and online presence

The main-menu leaderboard ranks published pilot profiles by `sessionTotalXp`.
The progression ledger only adds earned room deltas to that field. Spending
Fallbucks and changing Planet Pass tiers do not reduce it. The leaderboard
breaks ties by the private canonical profile key and exposes only position,
pilot name, XP and the requesting player's own-row marker. Publishing is
opt-in. Earlier profiles retain all XP and remain private until they publish a
name. Removing the entry leaves progression intact. Linking an unclaimed guest
to an account preserves that profile's single entry.

The database performs the top-10 and global-rank queries. The server shares a
20-second top-list cache and bounds its per-profile rank cache. The open panel
checks every 30 seconds. The explicit profile migration adds nullable
`leaderboard_name` and the partial `planetfall_leaderboard_rank_idx` index to
`planetfall_guest_profiles`. Apply it with the migration role before starting
the server. The local file fallback
stores optional names alongside its existing version-one profile data.

Players Online counts distinct server-verified account or guest profiles with
at least one connected game socket, including the main menu and every family.
Closing a last socket removes that profile after the server detects the
disconnect. Transport heartbeat timeouts detect interrupted connections, and
the server coalesces count broadcasts within one second. Legacy connections
without a verified profile are excluded. Presence makes no database writes.
The current single authoritative service defines the global boundary. A
multi-instance release would require shared presence before displaying a
deployment-wide count.

## Hosted storage

Set **`DATABASE_URL` on the server only** to a writable PostgreSQL endpoint
using the restricted runtime role. Keep database credentials out of Vite
settings, source files, builds and commits. Startup validates the catalog and
effective runtime grants, loads existing profiles and account links, then
starts listening. It uses read queries throughout. An incomplete or incompatible
schema, a read-only connection, or missing grants stops startup with an
actionable error. Reconnecting profiles are refreshed from PostgreSQL,
including profiles created after this server started.

Match settlement queues deltas for the affected profiles. Each database
transaction locks one profile row, applies earned XP and currency to the current
values, and derives Planet Pass rewards from that committed ledger. Shop
purchases and equipment changes validate against the same locked row. A
purchase commits the balance and ownership together. Concurrent purchases may
be rejected for insufficient funds or existing ownership.

Successful reward and Shop mutations record a server-generated UUID in the
additive `planetfall_profile_operations` table. The mutation and receipt commit
together. A retry with the same UUID returns the prior outcome and reads the
latest locked profile. The original profile rows, account links, display names,
and leaderboard index remain in place. Keep receipts across deploy and
rollback. They grow by one small
row per recorded operation. Removing receipts requires a retention policy that
proves no surviving writer can replay them.

Room results can report earned rewards before storage confirms them. The
profile update and Shop success reply follow commit. A failed reward save
surfaces a notice and retries while the process is alive. Graceful shutdown
drains pending records and reports failure if it cannot. Rewards still waiting
in process memory during a database outage can be lost if the process is
forcibly stopped. Committed transactions and receipts survive a restart.
Treat a persistent save outage as a reason to pause a rollout and drain the
service before restarting. Once the database recovers, queued operations retry
with their original receipts while the process is alive. After successful
startup, `/health` reports process liveness and storage mode. Verify actual
saves and reconnects as part of the release check.

Account claims serialize with Shop and visibility writes for the same profile.
A remote guest connection is checked at admission and periodically after an
account claim. Its Shop and visibility mutations are rejected by PostgreSQL as
soon as the claim commits. Already earned room rewards settle into the same
canonical row. Progression transactions do not write the public name. Other
instances may show a previously cached leaderboard entry until their cache
expires.

Keep one authoritative server instance for rooms and Players Online. Multiple
copies of the corrected persistence code can overlap without replacing each
other's committed profile records. That does not share room state or presence.

### Explicit migration and database roles

Build the vetted revision, then run the migration once from an authorized
operator environment. Mount the **direct**, writable Neon URL for the schema
owner as `PLANETFALL_MIGRATION_DATABASE_URL`. The command reads that one
variable. Render startup keeps only the restricted `DATABASE_URL`.
[Neon connection guidance](https://neon.com/docs/connect/connection-pooling#how-to-use-connection-pooling)

```sh
npm run build -w @planetfall/shared
npm run build -w @planetfall/server
npm run db:migrate -w @planetfall/server
```

Both connections must resolve the same existing ledger schema as their current
schema. The examples below use `public`. Review the actual schema, branch and
database before running the command. The migration role needs schema USAGE and
CREATE, ownership of the existing tables it must alter or index, and REFERENCES
on the profile key if it is creating referencing tables as a different role.
New tables belong to the migration role. Superuser is unnecessary.

A transaction-scoped advisory lock serializes migration runs. Each run inspects
the catalog and applies only the missing supported additions. An interrupted
transaction rolls back. A repeat run on the current schema reports that no
changes are needed. A same-name incompatible index, incompatible column, or
invalid existing constraint calls for a backed-up operator review. The command
does not replace those objects. The lock wait is bounded at five seconds and
each migration statement at 120 seconds. The first index build can block writes
and belongs in the maintenance window.

Create a dedicated SQL login such as `planetfall_runtime` without owner or
administrative role memberships. After migration, grant the following as the
owner. Supply database CONNECT separately if the database revokes it from
PUBLIC. If the runtime role inherits permanent schema CREATE or other elevated
permissions from existing grants, resolve those grants with the database
administrator before using the role. Neon SQL-created logins support these
custom grants. [Neon role management](https://neon.com/docs/manage/roles#manage-roles-with-sql)

```sql
GRANT USAGE ON SCHEMA public TO planetfall_runtime;

GRANT SELECT (id, progress, leaderboard_name), INSERT (id, progress),
      UPDATE (progress, leaderboard_name)
  ON TABLE public.planetfall_guest_profiles TO planetfall_runtime;

GRANT SELECT (id, profile_key, result), INSERT (id, profile_key, result)
  ON TABLE public.planetfall_profile_operations TO planetfall_runtime;

GRANT SELECT (issuer, auth_user_id, profile_key, preferences, preferences_revision),
      INSERT (issuer, auth_user_id, profile_key), UPDATE (preferences, preferences_revision)
  ON TABLE public.planetfall_account_links TO planetfall_runtime;

ALTER ROLE planetfall_runtime SET statement_timeout = '5s';
```

The role-level timeout applies to new database sessions. The application also
bounds connection acquisition and query waits. Runtime needs neither DELETE nor
ownership, REFERENCES, schema CREATE, sequence grants, or access to managed
`neon_auth` tables. Read access to the account-link table remains required with
Google sign-in disabled so previously claimed guest identities remain protected.
Profile UPDATE permission also permits the row locks used by transactions.
[PostgreSQL row-lock privileges](https://www.postgresql.org/docs/17/sql-select.html)

### First release and rollback

An already running server with the old whole-ledger writer can still overwrite
new progress. The additive receipt table cannot stop that writer. The first
release of this persistence change requires a maintenance cutover:

1. Rehearse migration, overlapping corrected writers, and restore in a
   disposable database. Record the vetted server and client revisions.
2. Obtain explicit operator authorization for the first production migration
   and cutover. Disable automatic replacement. Stop new matches and drain
   active rooms. Give the old server time to flush, then stop all legacy
   processes and verify they cannot reconnect or issue writes.
3. Verify writer exclusion before migrating. If fencing
   with separate database roles, revoke the old role's ability to write or
   reconnect and terminate its existing sessions. Changing a password alone
   does not close existing sessions. If the old role owns the ledger and
   cannot be fenced, keep the old process stopped and verify that explicitly.
4. Take and verify a recoverable backup of the profile, account-link and
   receipt tables that exist, with the Auth issuer mapping. Run the explicit
   migration with the separate owner connection. Run it a second time to
   verify the schema is current. Verify the limited grants before startup.
5. Start Render with the restricted runtime URL and check for
   `profileStorage: "postgresql"`. Release the matching Pages build, then
   verify reward, purchase, link, opt-out, presence and reconnect, including
   a restart. Monitor startup diagnostics and save failures before reopening
   matches.
6. Roll back only to a vetted build that retains the transactional writer
   and supports restricted startup. Leave additive schema and receipts
   intact and retain newer committed progress. If no compatible rollback
   build is available, keep the service in maintenance pending a verified
   recovery. A pre-fix whole-ledger writer is an unsafe rollback target.

The current `render.yaml` uses a Free web service. Render Free files are lost on
sleep/restart/redeploy and cannot use a persistent disk. **A PostgreSQL connection
must be configured for that hosted service; deploying this code alone does not
make its local file fallback durable.** No hosting plan, database or deployment
has been changed by this patch.

Release both the server and client changes together: older client bundles do
not send the guest-profile handshake and continue using room-only progress.
Existing room reconnection tokens are separate from the new profile token.

Render's [Free limitations](https://render.com/docs/free) and
[persistent disk documentation](https://render.com/docs/disks) describe those
storage constraints. Free Render Postgres databases expire after 30 days; use a
database whose lifetime matches the game's persistence requirements.

## Local development / disk-backed hosting

Without `DATABASE_URL`, development writes `server/data/player-profiles.json`
using temporary-file replacement. The data directory is ignored by Git. A
persistent-disk host can set `PLANETFALL_DATA_DIR` to its mounted data directory.
The file is for one writer only. Back up that data. Test servers use memory unless a test supplies an isolated
profile file/database. A malformed save is rejected rather than overwritten.

## Validation and limits

Focused tests earn actual Classic/BR match rewards, buy/equip an item, leave,
create a room in the other family, restart the server and verify the balance.
They also check independent same-name players and repeated-capture idempotence.
Database SQL runs against the PostgreSQL WASM engine in PGlite, including save,
application-store replacement, reload, rollback and uncertain-commit replay.
Run `npx vitest run server/src/profile-migrations.test.ts server/src/profile-postgres.test.ts`
with `PLANETFALL_TEST_PG_URL` pointing to a disposable loopback PostgreSQL server
with a test administrator authorized to create schemas and roles. The tests
create separate temporary migration and runtime roles. They cover fresh and
historical schemas, failed migrations, overlap, linking, purchase ordering,
restart and the unsafe legacy writer.
This does not validate the hosted database's credentials, TLS or availability.

The October 15 native-browser check also verified a 150-Fallbucks BR reward,
the home-shop balance after leaving, the same balance after refreshing, and
the balance in a new room. It used the ordinary authoritative timeout reward
path triggered by a local diagnostic control, not an injected wallet amount
or a naturally completed match. Evidence:
`artifacts/br-human-recovery-oct10/profile-native-v2-oct15.json`.

Hosted acceptance must complete a match, note the balance, leave/rejoin, refresh,
then restart the service and recheck from the same browser. Previously discarded
room wallets cannot be reconstructed from a database that never contained them.

The server's `/health` response reports `profileStorage` as `postgresql`, `file`
or `memory`, without publishing connection strings, local paths or profile data.
Use this to verify the deployed storage mode before testing hosted rewards.
`file` only identifies the backend; it does not guarantee the host keeps that
filesystem across restarts. `postgresql` confirms successful database startup,
not the database provider's retention policy or every future write.

## Initial hosted observation — October 20

Initial read-only checks of `https://planetfall-server.onrender.com/health` reported
`profileStorage: "file"`. At that point the live service was not using the PostgreSQL backend.
This does not prove whether a database exists in the hosting account or identify
the live plan/mounted disk. The committed Render blueprint specifies Free;
[Render documents](https://render.com/docs/free#local-files-lost-on-redeploy)
that Free filesystem changes are lost on restart, redeploy and spin-down.

At that initial inspection, the dashboard required user sign-in and no hosting
configuration had changed. The subsequent authorized setup is recorded below.

## Authorized Neon Free setup — October 20

After the user requested a free alternative and authorized setup, created the
Planetfall project on Neon **Free**, AWS US West 2 (Oregon), PostgreSQL 18,
production branch, database `planetfall_profiles`. No paid Render database or
paid Neon upgrade was created. The paid Render proposal was canceled.

Connected the pooled TLS URL through the existing Render service's DATABASE_URL
secret, preserving CLIENT_ORIGIN, NODE_ENV and NODE_VERSION. No database
credentials were written to repository files. The successful environment deploy
was `dep-dbc1123ncjis73fvd6r0`, running source checkpoint `259dc61`. Its public
health response reports `profileStorage: "postgresql"`, confirming actual hosted
PostgreSQL initialization. An earlier empty-value deploy was canceled before
the corrected configuration was applied.

A normal private hosted BR match was then used for reward/reconnect/restart
acceptance, recorded below. Startup success alone was not counted as acceptance.

Neon Free has usage limits; it is not an unlimited service. See
[Neon pricing](https://neon.com/pricing). Guest identity still depends on retaining
the browser's profile token until a profile is linked. Wallets discarded before
durable storage remain unrecoverable.

### Hosted durability acceptance completed

Normal private hosted BR match awarded **10 Fallbucks / 60 XP** from zero.
Both values survived BR leave, Classic room creation and a fresh Socket.IO
client handshake using the same guest identity. With no rooms active, restarted
the Render service and verified uptime reset from over 500 seconds to 25.9
seconds. A new handshake against that restarted PostgreSQL-backed process
restored the same 10 Fallbucks / 60 XP. All checks passed without injected
wallet values, forced results, fixture endpoints or modified match clocks.

Evidence: `artifacts/br-human-recovery-oct10/hosted-neon-earned-oct20.json` and
`hosted-neon-profile-oct20.json`; Free plan proof `neon-free-project-oct20.png`;
masked environment proof `render-neon-connected-oct20.png`. The reconnect check
validates server durability, not a fresh visual browser-refresh playtest. The
guest token remains in an ignored local diagnostic file, never in this evidence.
No source changes were necessary for this hosting correction. Existing full
suite/build/E2E results belong to checkpoint 259dc61; they were not rerun for
these documentation-only changes. Previously lost wallets remain unrecoverable.
