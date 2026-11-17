[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/bibitcuan1-boop/btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/bibitcuan1-boop/btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

# Deep-Dip Mean-Reversion Bot — cbBTC/USDC

A trading bot for the [make.fun btc-race-24h-20261117-0603 bounty](https://make.fun/bounty/btc-race-24h-20261117-0603): it races a BTC bot live for 24 hours, starting from 1,000 USDC of paper money, trading cbBTC against USDC on 1-minute bars.

## Strategy

A 1-minute bar moves only about 6 bps, while a full-size round trip costs roughly 30 bps in fees, slippage and price impact — so trading every wiggle is a guaranteed loss. This bot does the opposite: it waits for a genuinely deep dip and holds for the full swing back.

- **Buy** only when the close is at least **70 bps below its 90-bar EMA**.
- **Sell** only when the close has recovered to at least **50 bps above that EMA** — a ~120 bps swing per round trip against ~30 bps of costs.
- **Stop-loss**: sell if the close falls **100 bps under the entry close**, so a dip that keeps falling cannot sink the account.
- **Re-arm rule**: after any exit, no re-entry until the price has climbed back to within 30 bps of the EMA, so one bad dip cannot churn the account.

On the frozen 24 h dev window this fired just 3 round trips. It is deliberately slow and selective: few trades, each one sized at the full cash balance, each one needing a real move to pay.

## Dev-window result (grade-local)

- **Net PnL: +26.41 USDC** on the 1,000 USDC start (buy-and-hold makes +1.07, the momentum baseline +2.45 on the same window)
- **Trades: 6** (3 round trips, win rate 100%), **max drawdown: 0.72%**, Sharpe 0.043, 0 rejected orders
- Deterministic: the two grade-local executions reproduced byte for byte
- Positive on both halves of the window when checked separately (first 12 h +20.92, last 12 h +5.42), so the edge is not one lucky wiggle

## How to run it

Grade it locally on the dev window from the kit directory:

```sh
node cli/makefun.mjs grade-local --kit . --bot ~/workspace/btc-race-bot-repo --driver process --worktree
```

The bot itself is `main.ts`, run by the grader as `node /bot/main.ts`. It speaks the `agent-fun/bars-replay/v1` protocol (hello, one batch per minute, one reply per batch) via the vendored SDK shim in `vendor/makefun-bars.ts`. It is fully deterministic: no clock, no randomness, no network, no files outside the repo.

## Files

- `main.ts` — the bot entrypoint and the whole strategy.
- `vendor/makefun-bars.ts` — byte-for-byte copy of the kit's SDK shim.
- `LICENSE` — MIT.
