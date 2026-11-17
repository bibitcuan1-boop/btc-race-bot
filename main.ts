// Deep-dip mean-reversion bot for cbBTC/USDC, 1-minute bars.
//
// Idea, in one paragraph: on this market a 1-minute bar moves only ~6 bps
// (one standard deviation) and a full-size round trip costs ~30 bps, so
// chasing every wiggle is a guaranteed loss — every baseline that trades
// often loses money on the dev window. What does work is waiting for a
// genuinely deep dip and then holding for the full swing back: buy only
// when the close sits at least 70 bps below its 90-bar EMA, sell only when
// it has recovered to at least 50 bps above that EMA. That is a ~120 bps
// swing per round trip against ~30 bps of costs, and it fired just 3 times
// on the 24 h dev window. A stop-loss 100 bps under the entry close, an
// 8-hour max hold, and a re-arm rule (no re-entry until the price has
// climbed back to within 30 bps of the EMA) keep one bad dip from
// churning the account. Neither safety valve fired on the dev window;
// both exist for the unseen race window, where a dip can keep falling
// instead of reverting.
//
// Deterministic: the only state is the EMA and a few numbers carried from
// bar to bar; no clock, no randomness, no network, no files. The same bars
// always give the same orders, run after run.

import { runBars, type BarsState, type OrderInput } from "./vendor/makefun-bars.ts";

const SYMBOL = "CBBTC";
const EMA_SPAN = 90;
const MIN_BARS = 90;
const ENTRY_BPS = 70; // buy when close is this far below the EMA, in bps
const EXIT_BPS = 50; // sell when close is this far above the EMA, in bps
const REARM_BPS = 30; // re-arm entries only once back within this of the EMA
const STOP_BPS = 100; // sell if the close falls this far under the entry close
const MAX_HOLD_BARS = 480; // give up after 8 h without a recovery (never fired on dev)
const MAX_SLIPPAGE_BPS = 200; // 2%: wide enough for any normal 1-min move

// EMA over closes, seeded on the first close (so it is meaningless for the
// first few bars, which is why entries wait for MIN_BARS closes).
let ema: number | null = null;
let closesSeen = 0;
let entryClose = 0;
let entryBar = 0;
let armed = true;

const alpha = 2 / (EMA_SPAN + 1);

function deviationBps(close: number): number | null {
  if (ema === null) return null;
  return ((close - ema) / ema) * 10000;
}

await runBars({
  onBatch(state: BarsState, batch) {
    const orders: OrderInput[] = [];
    if (state.warmingUp) return orders;

    // Only the CBBTC bar of this batch advances the EMA. A batch with no
    // bar for our symbol (a gap minute) changes nothing.
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar === undefined) return orders;
    const close = Number(bar.c);
    if (ema === null) ema = close;
    else ema += alpha * (close - ema);
    closesSeen += 1;

    const held = state.positions.get(SYMBOL);
    const dev = deviationBps(close);
    if (dev === null || closesSeen < MIN_BARS) return orders;

    if (held === undefined) {
      // Flat: re-arm once the price has recovered toward the EMA, then buy
      // the next genuinely deep dip.
      if (dev > -REARM_BPS) armed = true;
      if (armed && dev < -ENTRY_BPS) {
        const cash = state.cash;
        const room = state.weightRoom(SYMBOL);
        const spend = cash < room ? cash : room;
        const minNotional = BigInt(state.hello.fees.min_notional_quote_units);
        if (spend >= minNotional && spend > 0n) {
          orders.push({
            side: "buy",
            symbol: SYMBOL,
            notional_quote_units: spend,
            max_slippage_bps: MAX_SLIPPAGE_BPS,
          });
          entryClose = close;
          entryBar = closesSeen;
          armed = false;
        }
      }
      return orders;
    }

    // Holding: take the full swing back, cut the loss if the dip keeps
    // falling instead of reverting, or give up after 8 h of no recovery.
    const fromEntryBps = ((close - entryClose) / entryClose) * 10000;
    if (dev > EXIT_BPS || fromEntryBps < -STOP_BPS || closesSeen - entryBar >= MAX_HOLD_BARS) {
      orders.push({
        side: "sell",
        symbol: SYMBOL,
        qty: held.qty,
        max_slippage_bps: MAX_SLIPPAGE_BPS,
      });
      armed = false;
    }
    return orders;
  },
});
