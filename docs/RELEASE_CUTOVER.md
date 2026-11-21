# Transactional progression release and rollback

This runbook covers the first release of the transactional profile writer and
explicit database migration. Execute hosted steps only after operator approval.
Record the actual database, Neon branch, schema, Render service and Pages project
before beginning. The local rehearsal uses synthetic profiles and local PostgreSQL.

## Prepare the release

1. Freeze the complete candidate, including the untracked migration, profile
   connection/schema, social-feature and shader-preparation sources. Use the
   rehearsal manifest to review the file inventory. The working-tree HEAD alone
   does not identify this candidate. Record an approved immutable source revision,
   dependency lockfile and the hashes of the server and client artifacts.
2. Preserve a separately built rollback candidate that contains both transactional
   progression and read-only restricted-role startup. Verify its receipts,
   purchases, account links and publication settings against the migrated schema.
   Record its immutable identity and artifacts alongside the current candidate.
3. Verify the actual Render and Pages settings against [the build contracts](DEPLOYMENT.md).
   Render builds shared/server and starts `server/dist/index.js`. Pages builds
   shared/client and publishes `client/dist`, with the account Functions proxy
   from the same revision. Set `VITE_SERVER_URL` to the intended Render HTTPS
   origin at client build time. Serve static assets from `/`.
4. Verify the direct migration connection and separate runtime login resolve the
   same writable database and ledger schema. Inspect ownership, role memberships,
   inherited grants, active connections, connection poolers and prepared
   transactions. Use a fresh restricted runtime login without owner or
   administrative memberships. Preserve the existing Auth issuer and account
   mapping. Effective hosted permissions require authorized verification.
5. Rehearse a recoverable backup and restore. Record the backup location,
   checksum, restore command and verified row state. Include the profile,
   account-link and operation-receipt tables that exist. Coordinate managed Auth
   recovery with the same issuer mapping.
   When restoring with `pg_restore --no-owner`, explicitly select the intended
   migration role with `--role`, or review and transfer the restored table
   ownership before migration. The restoring administrator otherwise becomes
   the owner. Restore into a fresh isolated database for verification.
6. Check the [local release commands](DEPLOYMENT.md#local-release-verification).
   Reuse results only while the relevant candidate sources match the validated
   inventory. Native PostgreSQL, browser and production-smoke checks have separate
   evidence. Keep the measured CPU budget on representative, quiet hardware.

## Enter maintenance

1. Announce the interruption and record whether active matches will finish or be
   deliberately terminated. The application currently has no operator-facing
   admission/drain switch. Use a verified hosting or ingress control that blocks
   new connections and closes existing game sockets. Suspending the retiring
   service is the termination option when a drain gate is unavailable.
2. Disable automatic source-triggered deployment and identify every legacy
   service, worker, manual process and credential that can write the ledger.
   Verify the retiring service remains stopped. A Pages maintenance notice alone
   cannot stop already loaded clients from connecting to Render.
3. Give graceful shutdown time to drain pending saves and inspect the exit result.
   This application's shutdown deadline is five seconds. A failed drain or forced
   termination requires inspection of unconfirmed rewards before proceeding.
   Committed rows and receipts survive. Rewards still held only in process memory
   during a save outage can be lost when that process is killed.
4. Keep maintenance active through migration, startup and acceptance. Record a
   final recovery point after the drain and writer fence.

Render's normal replacement starts the new instance before shutting down the old
one. Failed deploys can leave the previous version serving traffic. The first
transactional cutover therefore needs the explicit service stop and database
fence below. [Render deployment lifecycle](https://render.com/docs/deploys)

## Fence the legacy writer

Use an authorized database administrator on the verified direct endpoint.
Replace the example role names with reviewed names. Keep each permission change
committed before checking it from another connection.

1. Disable the retired login. This prevents fresh authentication while existing
   sessions are inspected and terminated.

   ```sql
   ALTER ROLE planetfall_legacy NOLOGIN;

   SELECT pid, usename, application_name, state, xact_start, backend_type
   FROM pg_stat_activity
   WHERE datname = current_database() AND usename = 'planetfall_legacy';

   SELECT gid, owner, prepared
   FROM pg_prepared_xacts
   WHERE database = current_database();
   ```

2. Resolve any prepared transactions with the database operator before continuing.
   Determine whether each contains valid pending progression. An unexplained
   prepared transaction is a stop condition. Terminate the old role's remaining
   sessions, including idle pools and transactions in progress.

   ```sql
   SELECT pid, pg_terminate_backend(pid, 5000) AS terminated
   FROM pg_stat_activity
   WHERE datname = current_database()
     AND usename = 'planetfall_legacy'
     AND pid <> pg_backend_pid();
   ```

3. Repeat the session and prepared-transaction queries. Require zero relevant
   sessions and zero unresolved prepared transactions. Investigate an unsuccessful
   termination. A signal request alone does not establish exclusion.
4. Transfer ownership of the specific existing ledger objects to the migration
   role and revoke the legacy role's table and column privileges. Review actual
   object existence before executing these examples. The table-owner change
   also transfers its indexes. Keep broader schema/database ownership changes
   under a separately reviewed object inventory.

   ```sql
   ALTER TABLE public.planetfall_guest_profiles OWNER TO planetfall_migration;
   ALTER TABLE public.planetfall_account_links OWNER TO planetfall_migration;

   REVOKE ALL PRIVILEGES ON TABLE public.planetfall_guest_profiles,
     public.planetfall_account_links FROM planetfall_legacy;
   REVOKE ALL PRIVILEGES (id, progress)
     ON TABLE public.planetfall_guest_profiles FROM planetfall_legacy;
   REVOKE ALL PRIVILEGES (issuer, auth_user_id, profile_key,
     preferences, preferences_revision)
     ON TABLE public.planetfall_account_links FROM planetfall_legacy;
   ```

5. Revoke any remaining column grants, including `leaderboard_name` when present,
   and any receipt-table grants when that table already exists. Inspect PUBLIC
   grants and inherited memberships that could still supply access. Verify the
   retired role has no effective INSERT or UPDATE on progression and no owner or
   administrative path to regain it. Use `has_column_privilege` for each actual
   column, together with the ownership and membership catalog.
6. Verify authentication using the retired credential fails at every endpoint the
   old process used, including the pooler. Verify no old process can restart with
   a write-capable credential. Retain the effective privilege check even if an
   upstream pooler caches authentication.
7. Record the fence timestamp and proof before allowing a corrected writer to
   accept operations. If the old and new builds share credentials, provision and
   verify the new restricted login first, then retire the old login completely.
   If a protected owner role cannot be fenced with the available administrative
   controls, keep maintenance active pending a verified operator procedure.

The local rehearsal showed an already-open transaction committing after NOLOGIN.
Terminating its backend rolled back the next uncommitted stale update. Ownership
transfer, privilege removal, rejected reconnects and a zero-session check completed
the fence. PostgreSQL documents the role and backend controls separately.
[ALTER ROLE](https://www.postgresql.org/docs/17/sql-alterrole.html),
[backend termination](https://www.postgresql.org/docs/17/functions-admin.html)

## Migrate and start the corrected server

1. Take and verify the final fenced backup. Preserve newer valid progression if
   investigating an earlier failed deployment.
2. In the approved candidate's operator environment, provide the direct migration
   credential only as `PLANETFALL_MIGRATION_DATABASE_URL`. Run the actual command.

   ```sh
   npm run db:migrate -w @planetfall/server
   npm run db:migrate -w @planetfall/server
   ```

3. Require a successful first execution and an already-current second execution.
   Compare profile and link data with the backup. Verify the checked nullable
   publication column, partial ranking index, account constraints and durable
   receipt table. Inspect errors before retrying an incompatible object.
4. Apply and verify the [runtime column grants](PLAYER_PROFILES.md#explicit-migration-and-database-roles).
   Runtime needs no schema ownership, DDL, DELETE, key UPDATE or migration secret.
   Apply its role timeout to new connections. Check the effective privileges of
   the actual hosted login, including inherited grants.
5. Select the approved corrected Render source revision and runtime credential
   while maintenance remains active. Inspect platform-triggered deploys when
   saving configuration. Require the intended corrected artifact before resuming
   the service. Leave the legacy login fenced permanently.
6. Verify the startup identity and `/health` reporting `profileStorage: "postgresql"`.
   Test a committed save and a fresh read. Health confirms startup and liveness;
   continue checking actual progression commits during acceptance.

Migration uses one transaction and a transaction-scoped advisory lock. An
interruption rolls its uncommitted DDL back. After inspecting the outcome, the
same command can be retried. An incompatible same-name object, wrong schema,
permission failure or unexplained lock requires operator review first.

## Release the client and accept traffic

1. Deploy the matching Pages revision with the recorded Render origin baked into
   `VITE_SERVER_URL`. Verify `ACCOUNT_SERVER_URL` and the runtime gateway secret
   for the Pages account proxy. Preserve the canonical Pages origin so existing
   browsers retain their guest token and first-party account cookies.
2. Confirm static assets, WebSocket connection, allowed CORS origin and rejection
   of an unlisted origin. Verify real sign-in callback and cancellation on the
   authorized hosted provider. The local fixture provider proves the application
   path and leaves hosted OAuth/TLS verification to that check.
3. Use two independent browsers to earn rewards, leave, refresh and reconnect.
   Verify exact committed XP/currency, cosmetics, Pass state, account ownership,
   public/private ranking choices and unique Players Online counts. Restart the
   corrected service and repeat fresh reads before ending maintenance.
4. Require previously loaded clients to reload after graceful replacement.
   The current shutdown explicitly disconnects Socket.IO clients. Those clients
   display Reconnecting but keep the menu disabled until reload. Confirm the
   same saved identities and restored Players Online count after that reload.
   The rehearsal tests the current and
   reconstructed Phase 4.2 protocol pair. Other historical bundles need their own
   compatibility evidence. Active rooms reside in one process and end on service
   replacement. Corrected database writers can overlap safely while room state
   and Players Online remain scoped to one authoritative service.
5. Resume traffic only after the acceptance record is complete. Monitor database
   startup, save errors, pending-save notices, shutdown results, account failures
   and reconnect behavior. Pause rollout if commits become unconfirmed.

## Roll back or recover

1. Enter maintenance if progression, startup or client/server compatibility fails.
   Retain the current database and incident evidence. Keep the legacy fence in
   place, including when a new or rollback build fails health checks.
2. Start only the recorded corrected rollback artifact with the restricted runtime
   login. Keep additive schema and operation receipts. Verify account links,
   preferences, publication choices and a fresh profile read before admitting
   test writes. Perform a new reward and verify it survives roll-forward.
3. If that rollback build fails to start, retain maintenance and inspect its
   artifact, configuration and database grants. Use the verified corrected
   candidate after resolving the cause. Keep the vulnerable writer retired.
4. Replaying a committed receipt is safe. Re-running a failed migration is safe
   after its transaction outcome and schema are inspected. Restarting after
   confirmed graceful drain is safe. A forced stop with unconfirmed saves requires
   reconciliation. Backup restoration after later valid writes requires an
   explicit recovery decision that preserves or reconciles those newer writes.

Routine rollback retains the additive migration. Receipts grow with successful
operations and remain part of replay safety. The tested rollback candidate is a
reconstructed local Phase 4.2 snapshot. Approve and retain an immutable corrected
rollback revision or that exact artifact before the hosted release.
