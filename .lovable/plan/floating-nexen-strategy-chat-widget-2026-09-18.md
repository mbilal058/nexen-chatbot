# Floating Nexen Strategy Chat Widget

## Goal
Replace the public full-page presentation with a collapsible chat widget anchored at the bottom-right, while keeping the admin dashboard as a separate full-screen experience.

## Changes
- Make `/` and `/chat` show the same floating Nexen Strategy chat launcher instead of a landing page.
- Add closed and open widget states, with a compact desktop/tablet panel and a safe full-screen mobile presentation.
- Preserve chat history, AI replies, handoff, polling, WhatsApp, and end-chat behavior.
- Add compact in-widget actions for “Request a Quotation” and “Book a Meeting,” with back navigation to chat.
- Adapt both forms for the narrow widget: single-column fields, wrapping labels, compact spacing, vertical scrolling, and no horizontal overflow.
- Keep `/quote` and `/book-meeting` working as standalone responsive pages.
- Use the existing Nexen semantic brand palette throughout; do not change the admin dashboard layout.

## Validation
- Check the widget closed/open states on desktop and mobile.
- Check chat sending and both in-widget forms for clipping or horizontal scrolling.
- Confirm the admin route remains full-screen and the app builds cleanly.
