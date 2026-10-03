# Persistent Sessions, NS IDs, and Latest-First Live Chats

## 1. Clear Chat (visitor) vs End Session (admin)
- The widget's End Chat button becomes **Clear Chat**. It clears the messages on screen and shows a fresh greeting, but does not close the session. The visitor's saved session stays in the browser.
- Messages sent before clearing stay saved and visible to the admin. The visitor only sees messages sent after the clear. The clear point is stored in the browser, and the widget hides older messages when it reloads.
- Only the admin's existing End Session control closes a session. The visitor-side close action is removed from the widget. If the admin closes a session, the widget still shows "Chat ended" and a Start New Chat button, which creates a new NS number.

## 2. Sequential NS IDs
- Every chat gets a readable number: NS0001, NS0002, and so on, assigned automatically by the database in order. Existing chats are numbered in the order they were created.
- The internal ID stays the same behind the scenes, so security and links don't change.
- NS IDs replace "Session f24befde" everywhere: the session list, chat header, session details, desktop notifications, toasts, the tab title and handoff alert emails. If the admin has a visitor name, it still shows, with the NS ID beside it.

## 3. Returning-visitor alerts and WhatsApp-style ordering
- New `last_message_at` time on each chat, updated whenever the visitor sends a message. If they send nothing for 30 minutes and then send again (after clearing chat or coming back to the site), the admin gets the full "New Message" alert: toast, chime, desktop notification, tab flashing and unread badge. Handoff alerts work as they do now.
- The Live Chats list is sorted by the latest visitor message, newest first. A chat moves to the top as soon as a new message arrives through the existing live updates.

## Technical details
- Migration: add `chats.session_number bigint` from a sequence (unique, backfilled in `created_at` order) and `chats.last_message_at timestamptz`. Backfill it from the latest user message.
- `chat.functions.ts`: return `session_number` from create/get. `sendChatMessage`/`sendUserMessage` set `last_message_at`, and return a `returning` flag when the previous visitor message is more than 30 minutes old. `closeChatSession` is no longer called by the widget.
- Shared `formatSessionId(n)` → `NS${String(n).padStart(4,"0")}` in `src/lib/nexen.ts`. It's used in admin.tsx and `email.functions.ts`, and the handoff email looks up `session_number`.
- admin.tsx: order by `last_message_at desc nulls last`. In the realtime message handler, bump the session's `last_message_at` locally and re-sort. The one-alert-per-session refs reset when a user message arrives after 30+ minutes of silence, which re-fires the new-message alert and badge.
- ChatWidget: `clearChat()` stores `nexen_chat_cleared_at` in localStorage, empties messages and shows the greeting locally without saving it.
