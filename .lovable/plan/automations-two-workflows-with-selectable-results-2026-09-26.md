# Automations: Two Workflows with Selectable Results

## What will change
- Show two workflow cards:
  1. **Social Media Post Scraper by Search Term**: scrapes social media posts based on keyword queries.
  2. **Social Media Post Scraper by Search Term - Date & Location**: a targeted scraper with date range and location filters.
- Each card gets two buttons:
  - **Run Workflow** opens that workflow's n8n form in a new tab.
  - **View Results** selects the card. Clicking anywhere on the card also selects it.
- The selected card gets a light blue (#5269f3) border and a soft highlight. The other card keeps its normal thin border.
- **Empty state:** when you first open the tab, no sheet loads. You see an icon and the message "Select a workflow above to view its scraping results."
- **Selected state:** the heading reads "Viewing Results: {workflow name}", and only that workflow's Google Sheet loads below it.
- Refresh Results and Mark as Processing sit next to the results heading and only show when a workflow is selected. Mark as Processing keeps its 90-second countdown and reloads the sheet on its own when time is up.
- Switching to the other workflow stops any countdown and loads that workflow's sheet.

## Technical details
- All changes are in `src/components/admin/AutomationsPanel.tsx`.
- A `WORKFLOWS` array holds each workflow's id, title, description, form URL and sheet URL.
- `selectedId` state starts as null. The iframe only renders when a workflow is selected, and its `key` combines the selected id with a refresh counter.
- Brand colours only; the rest of the dashboard is unchanged.
