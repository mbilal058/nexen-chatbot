# Live Chat Unread Indicators

## Goal
Add real-time new-chat and unread-message indicators throughout the Admin Dashboard without changing the existing chat workflow.

## Changes
- Replace the current per-session unread flag with per-session unread message counts.
- Mark newly created sessions and fresh human handoffs with a solid Nexen navy status dot.
- Increment a session’s badge for each new user message received while that chat is not open; the numeric badge replaces the dot.
- Clear both the unread count and new-session indicator immediately when an admin opens that chat.
- Show the cumulative outstanding count on the Live Chats navigation item in expanded, collapsed, and mobile navigation.
- Preserve existing real-time refresh, handoff notifications, audio alerts, and active-chat behavior.

## Visual Details
- Use the existing `brand-800` token, which is exactly `#000a61`.
- Use compact, centered white text for numeric badges, including a safe `99+` display cap.
- Keep indicators fixed-size and non-shrinking so session rows and navigation remain stable on smaller screens.

## Verification
- Confirm new sessions and human handoffs show a dot.
- Confirm consecutive user messages increment the session and sidebar counters.
- Confirm opening the session clears its indicators and updates the total.
- Check expanded/collapsed desktop navigation and mobile navigation for clipping or overlap.
