# Collapsible admin sidebar

## What will change
- Add an elegant toggle at the top of the desktop sidebar.
- Keep the current expanded navigation appearance with icons and labels.
- Collapse the sidebar into a narrow icon-only rail while preserving every tab action and active state.
- Show accessible labels/tooltips for collapsed icons.
- Animate sidebar width, label opacity, and the main dashboard area together with a smooth premium transition.
- Remember the selected sidebar state while navigating between dashboard tabs and after refreshes.
- Preserve the existing mobile bottom navigation and all dashboard content.

## Technical details
- Keep the behavior inside the shared `/admin` layout so Quotations, Meetings, Live Chats, Knowledge Base, and Settings all inherit it.
- Use semantic project colors and the existing button/tooltip components.
- Persist the desktop state in browser storage without reading it during server rendering.
- Verify expanded/collapsed behavior and main-content resizing in the live desktop preview.
