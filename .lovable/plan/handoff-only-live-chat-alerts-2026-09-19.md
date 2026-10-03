# Handoff-Only Live Chat Alerts

## Goal
Make Live Chat notifications appear only for sessions that request a human, and make visitor handoff immediate without a details form.

## Changes
- Change the handoff action so a text request or “Talk to Human” immediately marks that chat as human handoff, disables AI, records the handoff message, and opens live chat.
- Remove the handoff form and its related visitor-side fields and submission flow from the widget.
- Track alerts only after a session transitions into human handoff; ignore ordinary AI-session creation and messages.
- Show the handoff alert dot or unread count inline beside that session’s displayed ID/name in the Live Chats list using the existing exact `#000a61` brand token.
- Count subsequent visitor messages only while that session remains in human handoff and is not currently open.
- Clear that session’s alert and count when an admin opens it.
- Remove the cumulative Live Chats navigation and header counters so alerts remain session-specific.

## Verification
- Trigger handoff by button and by typed request, confirming no form appears.
- Confirm only the matching human-handoff session receives a dot/count and normal AI chats do not.
- Confirm opening the session clears its indicator and the app builds cleanly.
