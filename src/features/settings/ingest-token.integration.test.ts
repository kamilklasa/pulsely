import { describe, expect, it } from "vitest";
import { signInAsNewUser } from "@/shared/api/seam-b.utils";
import { generateIngestToken, hashIngestToken } from "./ingest-token.utils";

const TOKEN_COLUMNS = "id, label, created_at, last_used_at";

// Seam B — real local Supabase (`supabase start`), no mocking. A key is a
// credential that outlives the session that made it, so the only proof that one
// account cannot read or revoke another's is the database refusing it.
describe("ingest_token (Seam B)", () => {
  async function createToken(client: Awaited<ReturnType<typeof signInAsNewUser>>, label: string) {
    const plaintext = generateIngestToken();
    const { data, error } = await client
      .from("ingest_token")
      .insert({ token_hash: await hashIngestToken(plaintext), label })
      .select(TOKEN_COLUMNS)
      .single();
    if (error) throw error;
    return { id: data.id as string, plaintext };
  }

  it("keeps one owner's keys out of another's list", async () => {
    const alice = await signInAsNewUser("ingest-token-alice");
    const bob = await signInAsNewUser("ingest-token-bob");

    const aliceToken = await createToken(alice, "Alice's laptop");
    await createToken(bob, "Bob's laptop");

    const { data: aliceRows, error } = await alice
      .from("ingest_token")
      .select(TOKEN_COLUMNS)
      .is("revoked_at", null);

    expect(error).toBeNull();
    expect(aliceRows!.map((row) => row.id)).toEqual([aliceToken.id]);
    expect(aliceRows!.map((row) => row.label)).toEqual(["Alice's laptop"]);
  });

  it("refuses to hand back anything that could be pasted into a config file", async () => {
    const alice = await signInAsNewUser("ingest-token-hash");
    await createToken(alice, "MacBook");

    // The `select *` a curious client would reach for first. token_hash carries
    // no select grant, so this is refused outright rather than answered.
    const { data, error } = await alice.from("ingest_token").select("*");
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");

    // And naming the column directly is refused the same way — the guarantee is
    // the grant, not the shape the app happens to ask for.
    const { error: namedError } = await alice.from("ingest_token").select("id, token_hash");
    expect(namedError).not.toBeNull();
    expect(namedError!.code).toBe("42501");
  });

  it("will not let a client file a key against somebody else's account", async () => {
    const alice = await signInAsNewUser("ingest-token-insert-alice");
    const bob = await signInAsNewUser("ingest-token-insert-bob");

    const { data: bobUser } = await bob.auth.getUser();

    const { error } = await alice.from("ingest_token").insert({
      owner_id: bobUser.user!.id,
      token_hash: await hashIngestToken("x"),
      label: "gift",
    });

    // Bob would otherwise be authenticating with a key Alice holds the plaintext of.
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("will not let one owner revoke another's key", async () => {
    const alice = await signInAsNewUser("ingest-token-revoke-alice");
    const bob = await signInAsNewUser("ingest-token-revoke-bob");

    const bobToken = await createToken(bob, "Bob's desktop");

    // No error: the policy scopes the statement rather than rejecting it, so the
    // update simply matches nothing. What matters is the row Bob still has.
    const { error } = await alice
      .from("ingest_token")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", bobToken.id);
    expect(error).toBeNull();

    const { data: bobRows } = await bob
      .from("ingest_token")
      .select(TOKEN_COLUMNS)
      .is("revoked_at", null);
    expect(bobRows!.map((row) => row.id)).toEqual([bobToken.id]);
  });

  it("revokes a key out of the list, once and for good", async () => {
    const alice = await signInAsNewUser("ingest-token-revoke-own");
    const token = await createToken(alice, "Old laptop");

    const { error: revokeError } = await alice
      .from("ingest_token")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", token.id);
    expect(revokeError).toBeNull();

    const { data: rows } = await alice
      .from("ingest_token")
      .select(TOKEN_COLUMNS)
      .is("revoked_at", null);
    expect(rows).toEqual([]);

    // Un-revoking is what would make "it can never authenticate again" a
    // statement about the UI only. The trigger refuses it.
    const { error: undoError } = await alice
      .from("ingest_token")
      .update({ revoked_at: null })
      .eq("id", token.id);
    expect(undoError).not.toBeNull();
    expect(undoError!.message).toContain("write-once");
  });

  it("fixes the label and the hash at creation", async () => {
    const alice = await signInAsNewUser("ingest-token-immutable");
    const token = await createToken(alice, "Work laptop");

    // Only revoked_at is granted for update. Re-pointing a hash would hand a key
    // already sitting in a config file to a different secret; renaming would
    // detach the label from the machine the user revokes by.
    const { error: hashError } = await alice
      .from("ingest_token")
      .update({ token_hash: await hashIngestToken("other") })
      .eq("id", token.id);
    expect(hashError!.code).toBe("42501");

    const { error: labelError } = await alice
      .from("ingest_token")
      .update({ label: "renamed" })
      .eq("id", token.id);
    expect(labelError!.code).toBe("42501");
  });

  it("gives no client a way to delete the record of a key", async () => {
    const alice = await signInAsNewUser("ingest-token-delete");
    const token = await createToken(alice, "Laptop");

    const { error } = await alice.from("ingest_token").delete().eq("id", token.id);
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });
});
