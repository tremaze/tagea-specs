# Chat — Delete Message — Parity

WhatsApp is the consumer-app benchmark our users compare
us against. This document records where we mirror it,
where we diverge, and why.

## Same as WhatsApp

- **Delete for everyone is the default flow.** A single
  "Delete" entry in the message action menu, opening a
  confirmation dialog, replacing the bubble with a
  placeholder ("This message was deleted").
- **48-hour limit on deleting your own messages.** WhatsApp
  enforces a similar window on "delete for everyone" (it
  has shifted between ~1 hour and ~2 days over the years;
  our 48-hour value matches the current public guidance).
  Beyond the window the option disappears from the menu.
- **Deletion federates / propagates everywhere.** WhatsApp
  relies on the server pushing a delete tombstone to each
  recipient device; Matrix accomplishes the same effect via
  redaction federation. The user-facing outcome is
  identical: the message is gone for every participant.
- **Push notifications already on screen are not retracted.**
  Both apps accept this as a known limitation.
- **Group admins can delete other members' messages.** On
  WhatsApp this is the "delete for everyone" admin-only
  power; on Matrix we gate it on
  `m.room.power_levels.redact` ≤ user level.

## Different from WhatsApp (intentionally)

- **No "delete for me".** WhatsApp lets you remove a
  message from your own device only ("delete for me"). v1
  does not implement this — Matrix has no built-in
  primitive and we'd be inventing one. Tracked as future
  work in the spec.
- **Placeholder text differentiates self vs. moderator.**
  WhatsApp shows the same generic "This message was
  deleted" regardless of who deleted it. We can do better
  because Matrix tells us who performed the redaction:
  - "You deleted this message" (own deletion)
  - "This message was deleted by a moderator" (other than
    the original sender)
  - "This message was deleted" (fallback, e.g. self-
    deletion seen by another user)
- **No deletion reason in v1.** Matrix supports a
  `reason` on `m.room.redaction`; we pass none. WhatsApp
  also surfaces no reason. Could be added later for
  moderation logs without breaking the spec.
- **No "deleted by Author" attribution string for
  recipients.** WhatsApp surfaces "This message was
  deleted" rather than naming the deleter. We follow that
  lead — the placeholder strings name the *role*
  (moderator / self) but not the user, even though we have
  the data.

## Outside both apps

- **Federation across homeservers.** Matrix-only concept.
  Redactions hop from your homeserver to the others in the
  room over the federation API; for participants on other
  homeservers the message disappears as soon as their
  server receives the redaction. No equivalent WhatsApp
  surface — they own the entire infra.
- **Power-level model.** Granular per-room, per-action
  permissions instead of "admin / not admin". Means we can
  in principle let, say, a teacher redact student messages
  in a classroom room without making them a full admin —
  but v1 just consults the existing `redact` level.

## Sources

- [WhatsApp FAQ — How to delete messages](https://faq.whatsapp.com/1322323105557654/?cms_platform=android)
- [Matrix Spec — m.room.redaction](https://spec.matrix.org/v1.11/client-server-api/#mroomredaction)
- [Matrix Spec — Power levels and redaction](https://spec.matrix.org/v1.11/client-server-api/#mroompower_levels)
