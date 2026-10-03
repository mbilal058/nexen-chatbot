# Standardize Chat Timestamps to Pakistan Time

## Changes
- Add one shared formatter for Pakistan Standard Time using `Asia/Karachi`, a 12-hour clock, seconds, and AM/PM.
- Apply it to session list timestamps and session details in Live Chats.
- Show the same timestamp beneath every admin and public chat message bubble, including newly sent messages.
- Update human-handoff emails to include one clearly labeled PKT timestamp in the same 12-hour format and remove the duplicate UTC timestamp.

## Validation
- Confirm session rows, chat bubbles, and notification email content all use the shared PKT format.
- Check the app build and verify the Live Chats interface at desktop and mobile widths.

## Technical details
- Use `Intl.DateTimeFormat` with `timeZone: "Asia/Karachi"`, `hour12: true`, and explicit date/time fields so output is independent of the viewer's device timezone.
