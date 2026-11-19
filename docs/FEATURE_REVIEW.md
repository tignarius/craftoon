# Current release feature review

Reviewed 2026-11-13 against `fb6a099` and the running iPad simulator.

| Area | Current behavior | Documentation decision |
| --- | --- | --- |
| Panel editing | Layout and Draw only | Remove separate Edit/select-stroke mode instructions |
| Stroke selection | Native PencilKit lasso inside Draw | Explain the lasso in the system drawing palette |
| Tracing | One Photos/Files reference per panel | Show the in-panel import icon; no top-level image tool |
| Reference transforms | Move, rotate, scale, opacity, delete; fixed panel toolbar | Explain that transforms affect only the image |
| Reference visibility | Eye toggle; settings/check to expand/collapse controls | Controls exist only after import; tap Done to resume drawing |
| Library | Centered Edit/Read/Delete overlay; faded preview; stable card size | Include empty-space deselection and deletion Undo |
| Page orientation | Portrait/landscape picker; placement follows rotation | Keep start instructions short |
| App menu | Current mode, guide, edition/version, unlock/restore, activation, About | Explain one consistent top-left entry point |
| Free/Pro | Free: up to 4 pages; Pro: save, more pages, PDF email, print | Label paid actions with an outlined PRO badge |
| Ink and photos | File-backed storage, inactive previews, bounded undo history | Describe improved handling; avoid unlimited-performance guarantees |

Do not advertise standalone text, sticker, speech-bubble creation, cloud sync, an external layer per stroke, a separate Edit panel mode, an unlimited stroke count, or standalone image export. Some legacy code/data types remain, but these are not reachable creation tools in the current released UI. PDF delivery is through email; printing is also available. Automatic recovery does not replace an explicit Pro Library save.

The main guide images show a single empty panel created by dragging in the running app. The reference toolbar capture uses an imported simulator sample photo with visibility turned off, so only the real controls appear. Icons are never redrawn or relocated within screenshots. The PencilKit palette shown is from iPadOS 27.2; its tools and arrangement can vary with iPadOS and palette position.
