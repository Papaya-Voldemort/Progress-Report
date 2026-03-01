# Progress Report Studio

A polished, minimal progress-tracking web app built with vanilla HTML, CSS, and JavaScript.

## Features

- Create long-term projects/goals.
- Add, rename, complete, and delete tasks.
- Add, rename, complete, and delete subtasks.
- Automatic percentage rollups:
  - Subtask completion contributes to task completion.
  - Task completion contributes to project completion.
- Project notes with debounced autosave feedback.
- Local persistence with defensive data sanitization.
- Graceful fallback for corrupted storage.
- Micro-animations and glassmorphism-inspired visual style.
- Appwrite integration scaffold included as commented placeholder in `index.html`.

## Run

Open `index.html` directly, or serve with any static file server:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Data model

Stored in `localStorage` under `progress-report-studio-v1`.

- `projects[]`
  - `title`, `notes`, timestamps
  - `tasks[]`
    - `title`, `completed`, timestamps
    - `subtasks[]`
      - `title`, `completed`, timestamps

## Edge-case handling

- Empty values are rejected for names.
- Input is normalized and length-limited.
- Invalid persisted JSON is detected and safely reset.
- Missing IDs/dates are regenerated/sanitized.
- UI remains usable when no project or task exists.
- Save failures in restrictive environments show user feedback.

## Future Appwrite integration

See commented section in `index.html` for a ready starting point to swap local persistence for Appwrite collections.
