/**
 * One-time runbook — REVERSE the fake "HMS wallet sync (auto)" balance_correction
 * DEBITS that wrongly wiped resident wallet credits.
 *
 * Background
 * ----------
 * The reconciliation pull (pullHmsWalletBalances) used to treat HMS as the
 * absolute source of truth and insert a `balance_correction` DEBIT whenever the
 * HMS balance was lower than the CRM ledger. For residents whose CRM credit had
 * not yet propagated to HMS (HMS reported 0 / a low value), this destroyed real
 * credit — e.g. -₹15,000 package credits showing as "Correction · HMS wallet
 * sync (auto)". The pull no longer auto-corrects (it is report-only now, see
 * server/hms-wallet-sync.ts); this script gives the money back.
 *
 * It inserts a compensating CREDIT for each fake auto-debit, tagged
 * refType="auto_correction_reversal" with refId = the original ledger entry id,
 * so it is fully idempotent — re-running never double-credits. Real à-la-carte
 * spend debits are untouched (they have a different refType, not
 * "balance_correction").
 *
 * Usage (run where DATABASE_URL is set — e.g. the Replit shell):
 *   tsx scripts/reverse-fake-wallet-corrections.ts                 # DRY RUN — prints what it would do
 *   tsx scripts/reverse-fake-wallet-corrections.ts --apply         # insert the compensating credits
 *   tsx scripts/reverse-fake-wallet-corrections.ts --apply --since=2026-06-01
 *                                                                  # only reverse debits on/after a date
 */
import { db, pool } from "../server/db";
import * as schema from "@shared/schema";
import { and, eq, gt, like, gte } from "drizzle-orm";

const APPLY = process.argv.includes("--apply");
const sinceArg = process.argv.find((a) => a.startsWith("--since="));
const since = sinceArg ? new Date(sinceArg.split("=")[1]) : null;

async function main() {
  const conds: any[] = [
    eq(schema.walletLedger.refType, "balance_correction"),
    gt(schema.walletLedger.debit, 0),
    like(schema.walletLedger.note, "HMS wallet sync (auto)%"),
  ];
  if (since && !isNaN(since.getTime())) {
    conds.push(gte(schema.walletLedger.createdAt, since));
    console.log(`Filtering to debits on/after ${since.toISOString()}`);
  }

  const fakeDebits = await db.select().from(schema.walletLedger).where(and(...conds));

  // Idempotency: skip any debit that already has a reversal.
  const reversals = await db
    .select()
    .from(schema.walletLedger)
    .where(eq(schema.walletLedger.refType, "auto_correction_reversal"));
  const reversedIds = new Set(reversals.map((r) => r.refId));
  const toReverse = fakeDebits.filter((e) => !reversedIds.has(e.id));

  const total = toReverse.reduce((s, e) => s + (e.debit || 0), 0);
  console.log(`\nFake auto-debit corrections found: ${fakeDebits.length}`);
  console.log(`Already reversed:                  ${fakeDebits.length - toReverse.length}`);
  console.log(`To give back now:                  ${toReverse.length}  (total ₹${total})\n`);
  for (const e of toReverse) {
    const when = e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt);
    console.log(`  booking=${e.bookingId}  +₹${e.debit}  (undo ${when})`);
  }

  if (!APPLY) {
    console.log(
      `\nDRY RUN — nothing written. Re-run with --apply to insert the ${toReverse.length} compensating credit(s).`,
    );
    await pool.end();
    return;
  }

  let done = 0;
  for (const e of toReverse) {
    await db.insert(schema.walletLedger).values({
      bookingId: e.bookingId,
      credit: e.debit, // give back exactly what was wrongly taken
      debit: 0,
      refType: "auto_correction_reversal",
      refId: e.id, // idempotency key → the original fake debit
      note: `Reversal of fake HMS-sync auto-debit (₹${e.debit}) — credit restored`,
    });
    done++;
  }
  console.log(`\nDONE — inserted ${done} reversal credit(s); gave back ₹${total}.`);
  await pool.end();
}

main().catch(async (err) => {
  console.error("reverse-fake-wallet-corrections failed:", err);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
