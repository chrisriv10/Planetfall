# Saved Fallbucks and guest profiles

Fallbucks previously belonged only to a room's in-memory player record. They
survived a rematch, but leaving the room discarded that wallet. Both Classic and
BR now restore the same server-owned guest profile when that browser joins a new
room. Currency, crowns, XP/pass progress, owned cosmetics and equipment are saved.

The client stores only a random bearer token under `planetfall:profile-token`.
Balances are never accepted from browser storage or client payloads. Profile
tokens are sent only to their owning connection; the database stores token hashes.
Changing the display name does not change the wallet. Another player using the
same name cannot claim it. Clearing site storage or using another browser starts
a different guest profile; account login/recovery is not implemented here.

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
