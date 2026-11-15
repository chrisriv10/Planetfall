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

## Hosted storage

Set **`DATABASE_URL` on the server only** to a durable PostgreSQL connection URI.
Do not put it in any `VITE_` setting, client build, source file or commit. Startup
creates `planetfall_guest_profiles` and loads existing profiles before accepting
connections. A configured database failure stops startup rather than resetting
players to fresh wallets. Writes are parameterized, serialized and coalesced;
pending updates retry after transient failures. Shutdown drains pending writes.

Keep one authoritative server instance, matching the existing room architecture.
The profile cache/write coordinator is not a distributed multi-writer service.

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
Back up that data. Test servers use memory unless a test supplies an isolated
profile file/database. A malformed save is rejected rather than overwritten.

## Validation and limits

Focused tests earn actual Classic/BR match rewards, buy/equip an item, leave,
create a room in the other family, restart the server and verify the balance.
They also check independent same-name players and repeated-capture idempotence.
Database SQL runs against the PostgreSQL WASM engine in PGlite, including save,
application-store replacement, reload and a simulated transient write failure.
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
