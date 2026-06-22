import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, like, gt, sql } from "drizzle-orm";

/**
 * One-time fix: reverse all auto-debits that the HMS wallet sync wrote to the
 * CRM ledger before the policy was corrected (CRM is credit source; debits
 * should never be applied automatically from HMS data).
 *
 * Idempotent — it checks for an existing reversal entry before inserting, so
 * it is safe to call on every server restart.
 */
export async function reverseWrongfulHmsDebits(): Promise<void> {
  try {
    // Find every debit entry written by the HMS wallet sync job
    const wrongfulDebits = await db
      .select()
      .from(schema.walletLedger)
      .where(
        and(
          gt(schema.walletLedger.debit, 0),
          like(schema.walletLedger.note, "HMS wallet sync (auto)%"),
          sql`${schema.walletLedger.refType} = 'balance_correction'`
        )
      );

    if (wrongfulDebits.length === 0) {
      console.log("[fix-hms-debits] No wrongful HMS debit entries found — nothing to reverse.");
      return;
    }

    let reversed = 0;
    let alreadyDone = 0;

    for (const entry of wrongfulDebits) {
      // Check if a reversal already exists for this specific debit entry
      const existing = await db
        .select({ id: schema.walletLedger.id })
        .from(schema.walletLedger)
        .where(
          and(
            eq(schema.walletLedger.bookingId, entry.bookingId),
            like(schema.walletLedger.note, `Reversal: HMS sync debit #${entry.id}%`)
          )
        );

      if (existing.length > 0) {
        alreadyDone++;
        continue;
      }

      await db.insert(schema.walletLedger).values({
        bookingId: entry.bookingId,
        credit: entry.debit,
        debit: 0,
        refType: "balance_correction",
        note: `Reversal: HMS sync debit #${entry.id} — credit restored (CRM is source of truth)`,
        performedBy: "system",
      });
      reversed++;
    }

    console.log(`[fix-hms-debits] Done — reversed: ${reversed}, already reversed: ${alreadyDone}, total found: ${wrongfulDebits.length}`);
  } catch (err: any) {
    console.error("[fix-hms-debits] Failed:", err.message);
  }
}
