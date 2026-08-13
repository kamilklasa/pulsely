# 1. MFA recovery path and un-enrolment policy

Date: 2026-08-12

## Status

Accepted

## Context

Issue #18 adds TOTP two-factor authentication to the Settings dialog. Two questions had
to be answered before any of it could be written, because both change what gets built
and both are security decisions rather than implementation details.

**What happens to a user who loses their authenticator?** Supabase Auth does not
support recovery codes — the API has no concept of them. Its documented answer is to
let a user enrol up to ten factors (`auth.mfa.max_enrolled_factors`) and treat a second
TOTP factor as the backup. Building recovery codes ourselves would mean a new table,
RLS policies, a hashing scheme, single-use accounting, and generation/verification in an
Edge Function, because the service role key can never reach the browser.

**What does un-enrolment demand?** `unenroll()` is the call that _downgrades_ account
security, so a valid session is not a sufficient gate — a stolen session would be enough
to strip 2FA off the account and lock the owner out. Supabase raises the session's
assurance level to AAL2 after a successful `verify()`, but a session that reached AAL2
an hour ago is not evidence that the person clicking "remove" holds the factor _now_.

## Decision

**No recovery codes.** A second TOTP factor is the backup. The Security section shows a
standing prompt to add a second app for as long as only one factor is active, and the
sign-in challenge lets the user pick which enrolled app answers it — a backup that could
not be chosen at the challenge would not be a backup at all. This is recorded here rather
than built, per the issue's request for "an explicit decision recorded in an ADR".

A user who loses every enrolled factor has no self-service path back in. Recovery is a
manual admin un-enrol via the service role. This is a known gap: the project has no
support process today, and the prompt to add a backup factor is what keeps users out of
that state. Revisit if 2FA adoption makes lockouts common.

**Un-enrolment requires a fresh TOTP code.** Removing a factor runs a full
`challenge()` → `verify()` against the factor being removed, immediately before
`unenroll()`. Not a password prompt: accounts created through Google OAuth have no
password credential, so a password gate would leave those users unable to manage their
own factors. Not a time-boxed AAL2 window either — the code is cheap to enter and it
proves possession at the moment of the request, which a timestamp does not.

This gate covers _verified_ factors. Abandoning the setup dialog un-enrols the factor
`enroll()` just created without asking for a code: it was never verified, so it protects
nothing, and leaving it behind would silently consume one of the ten enrolment slots.

Both enrolment and un-enrolment operate on the session owner only. No user id or factor
id is ever accepted from outside the current session's own `listFactors()` result.

The assurance level is read fresh on every navigation rather than cached. It is decoded
from the JWT the client already holds, so there is no round trip to save — and a cached
"aal2" that outlives the session that earned it is a bypass, not an optimisation.

## Consequences

- No custom secret storage, no hashing scheme, no Edge Function — the whole feature is
  client-side calls against Supabase Auth with the session's own JWT.
- Removing a factor costs the user one extra code entry. Deliberate: it is the only step
  in the feature that makes the account less safe.
- A user with exactly one factor who loses it is locked out and needs manual
  intervention. Accepted, mitigated by the backup-factor prompt.
- `auth.mfa.totp.enroll_enabled` and `verify_enabled` are switched on in
  `supabase/config.toml`. On hosted Supabase, MFA requires a Pro plan.
