# Nexen Admin Dashboard Color System

## What will change
- Apply an admin-only theme using the exact Nexen colors: dark blue `#000a61`, light blue `#5269f3`, cyan `#21e1f0`, orange `#f2ab41`, red `#f10907`, and pure white `#ffffff`.
- Keep the dashboard shell, sidebars, panels, cards, tables, form controls, popovers, and chat area pure white with subtle light borders.
- Standardize headings and primary text to dark blue, primary actions and interaction states to light blue, focus/highlight accents to cyan, warning states to orange, and destructive/error states to red.
- Preserve Live Chat notification dots and counters in exact dark blue, while styling New and Handoff tags consistently with the palette.
- Update Quotations, Meetings, Knowledge Base, Settings, and Live Chats so status indicators and tags no longer use unrelated slate, green, sky, rose, or violet color families.
- Preserve the existing layout, behavior, responsive navigation, notifications, and data workflows.

## Technical details
- Scope semantic color-variable overrides to the Admin Dashboard root so the public chatbot and forms are unaffected.
- Replace remaining admin-specific raw color classes and inline colors with the existing Nexen brand tokens.
- Verify every dashboard tab in the authenticated live preview, including active navigation, tables, status selectors, controls, chat bubbles, focus states, and notification badges.
- Confirm the preview builds without errors and that desktop and mobile navigation remain visually stable.
