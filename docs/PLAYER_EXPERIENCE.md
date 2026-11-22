# Beyond the Launch: player experience

## Finding a match

The home screen offers **Quick Match** for public Planetfall Classic, **Play Solo · Bots**, and the existing private create/join workflow. Quick Match uses the single authoritative RoomManager and ordinary Classic GameRoom. It never selects private, full or started rooms. Matching is scoped to this server instance; there is no distributed queue.

Verified canonical profile identity owns one queue slot. Repeated requests are idempotent, duplicate tabs cannot reserve another slot, and requests are bounded to one new search per second. Ordinary room-code joins cannot bypass the public queue. A disconnected pilot can still reconnect to an active match with its verified profile and existing session token.

Public lobbies show actual connected human counts and retain ready/host-start controls. After 15 seconds the host may explicitly choose **Start with bots**; bots are never represented as humans. Other humans must be ready. Waiting users may cancel or leave normally. Lobby disconnect removes the reservation immediately; active-match disconnect uses existing reconnect behavior. A waiting lobby expires after five minutes, removes memberships and tells connected pilots why. Returning to a rematch lobby starts a fresh bounded waiting period. Public Chaos and manual bot-add are unavailable; other families retain existing private and solo flows.

## Learning and inviting

**How to Play** is available from home and pause, with four family guides and PlanetGun ruleset explanations. Labels follow current keyboard/controller bindings. Optional first-match tips appear only in lobby/countdown, never during active combat. Read/skipped hints and the global hints preference persist locally under `planetfall.player-guide.v1`; this preference is not Career progress. The manual remains available after skipping hints.

Private lobbies offer **Copy Invite Link**. Links contain only canonical family and six-character room code, never an identity/session token. Opening a link selects the family and prefills the code, including after reload; the invited player must confirm Join Game after account initialization. An unavailable/wrong-family room uses existing authoritative join errors. Public lobbies do not publish private invite links.

## Career and results

**Career** is private and available from home and all four results screens. It combines existing authoritative level, XP, wallets and Pass progress with new per-family completions/wins and 13 recognition-only achievements. See [CAREER.md](CAREER.md) for exact eligibility, receipts and account behavior. Existing players begin new Career tracking at zero; historical XP is never converted to invented results.

Existing outcome/reward summaries remain intact. Eligible results display saving/confirmed Career and reward status based on a private post-commit receipt. Achievements produce one deduplicated summary, and Classic results offer **Find Another Match** through normal room-leave and Quick Match. Short/ineligible matches explicitly explain the lack of Career credit.

## Resources and release requirements

There is no new renderer, simulation, per-frame network polling, database table or migration. The public waiting panel has a one-second local countdown timer only while visible. Career adds one receipt-backed transaction per eligible profile per match, reusing existing retry/locking and runtime grants. Private Career fields are stripped from public room views and snapshots. Existing leaderboards/presence remain separate.

This work is local-only. A future release still requires the existing approved build/migration/rollback process and matching client/server contracts; this document does not authorize deployment. The optional Quick Match expansion to other families and a new Zombies-wave achievement are deferred.

Browser fixtures use a freshly compiled server, loopback services, isolated profile files and a test-only 30-second Classic duration. They perform genuine timed gameplay rather than injecting victories. The restart scenario launches a new Node process against the same isolated profile file. Native PostgreSQL tests use a disposable local cluster; no production profile, database or hosting setting is needed.

Run `npm run test:e2e:experience` for the complete public-match/invite/restart/UI journeys. Run `npm run test:e2e:career-accounts` for genuine guest progress linked through the isolated account-provider fixture and reopened in a second browser. The latter reuses the existing account fixture's bounded overtime; it never calls Google or modifies real accounts. Dedicated fixtures are excluded from the generic E2E project so they cannot silently run against the wrong clock or service.
