# Stricter Chat Alerts and Duplicate Reply Fix

## 1. Alerts fire only on three events
The chime, sidebar badge, desktop notification and tab flashing will fire only for:
- **New chat**: the first visitor message in a new NS session. This fires once per session.
- **Returning visitor**: the first message a visitor sends after pressing Clear Chat, in the same NS session. It shows as a "New Message" alert.
- **Human handoff**: the visitor clicks Talk to Human, or types "talk to human" in any capitalisation. This shows as the urgent handoff alert.

Other alerts will stop firing: the 30-minute "came back after silence" re-alert, and the chime for every visitor message during a handoff. Unread counts on chats you have open still update. Other dashboard messages, such as export successes, prompt saves and errors, are not affected.

## 2. No more duplicate bot replies
- Pressing Send or Enter locks the chat right away. The text box and Send button are disabled and a typing indicator shows.
- Extra clicks or Enter presses are ignored until the bot's reply appears on screen. Each message goes to the bot only once.
- The lock also covers live chat with staff, so a message can't be sent twice.

## Technical details
- ChatWidget: add an `isProcessingRef` lock plus an `isProcessing` state. `handleSend` returns early if the lock is set, sets it before any await, and releases it in `finally`. The Input and Send button get `disabled={isProcessing || state==="ENDED"}`. The input is focused again after the reply.
- Typed handoff: on the client, check `/talk to human/i` before sending. On a match, save the user's message and call `startLiveChat("button")` directly, so the bot doesn't reply. The existing server trigger stays as a fallback.
- Returning visitor: `clearChat()` sets `nexen_chat_resume_pending` in localStorage. On the next send, the widget passes `resumed: true` to `sendChatMessage`/`sendUserMessage`, then clears the flag. When `resumed` is set, the server inserts a system message "Visitor returned after clearing chat" before the user message.
- admin.tsx realtime: remove the `RETURN_GAP_MS` re-arm and the per-message handoff `flagAttention`. On a system message with the returned marker, clear `notifiedNewRef` for that chat so the next user message fires the "new" alert. Keep the first-message alert and the bot to human alert.
