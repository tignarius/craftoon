# Current release feature review

Reviewed 2026-11-20 against application checkpoint `7312da23` and the latest accepted English Quick Guide. This describes the development build, not a published App Store version.

| Area | Current behavior | Documentation decision |
| --- | --- | --- |
| Main screens | Canvas, Library, Read | Retain the three-mode guide structure |
| Panel modes | Layout and Draw; PencilKit lasso selects strokes | No separate Edit/select-stroke mode |
| Panel geometry | Rectangles/slanted quadrilaterals, resize, snapping and guides; corner tool switches between resize and horizontal reshape | Show the circle-to-shape-tool diagram |
| Borders | Solid, dashed, dotted, invisible | Toolbar symbol has three equal-length lines; the four choices sit beneath it |
| Templates / Auto arrange | Template spacing; rough layouts are tidied while preserving occupied height and already aligned panels | Include the green PanelsTopLeft + Sparkles icon |
| Artwork lock | Layout-only Image + Lock control keeps artwork fixed while the boundary changes; unlocked ink follows geometry | Explain the lock separately from tracing-image visibility |
| Live reshape | Cached image follows the drag; editable PencilKit ink transforms once on release | Do not describe a destructive flattened drawing |
| Panel zoom | Only the chosen panel enlarges; borders and controls stay sharp and controls appear outside | Keep the separate zoom card |
| Tracing | One Photos/Files reference per panel; move, rotate, scale, opacity, visibility, delete | Controls appear only after import and in Draw mode; no main-toolbar import tool |
| Library selection | Canvas/Read/Delete overlay, faded preview, stable card size; empty-space deselection and deletion Undo | Use the existing selected-comic capture |
| Library order | Long-press and drag a cover, with edge auto-scroll; persist order separately from comic files; failed saves restore the previous order | Accessibility actions can also move a comic earlier/later |
| Read / export | Swipe pages; Pro PDF email/printing; email state scoped to the reader session; native Mail dismissal handled | Native email window opening confirmed on the older iPad; actual email delivery was not tested |
| Orientation | Splash/Library rotate; Canvas/Read retain chosen page orientation | Device-specific OS window behavior is not a universal compatibility guarantee |
| Page menu | Previous, delete, add and next, beside the page counter; deletion confirmation | Guide shows the actual triangles, minus and plus, linked to one counter |
| Empty documents | No template save prompt on an empty active page; manually drawn unsaved layouts still prompt | Do not imply that empty templates count as artwork |
| Free / Pro | Free: 4 pages per comic, 1 saved comic and resaving that comic; Pro: unlimited pages/comics, PDF email and print | Keep outlined Free/Pro badges and correct limits |
| App menu | Current mode, offline guide, edition/version, unlock/restore, activation and creator credit | Use the consistent top-left mode entry point |

No reachable standalone text, sticker or speech-bubble creation tool, cloud sync, separate Edit panel mode, external layer per stroke, unlimited stroke-count guarantee or standalone image export is advertised. Legacy types/functions are not evidence of a current creation tool.

The current guide is vector-first: application Lucide icons and exact custom geometry, plus one crop from the existing real Library capture. It omits the PencilKit palette because that interface varies with the OS. The common English PDF is shared by both orientations. Its Library illustration does not yet demonstrate long-press reordering; the feature exists in the app but was not added to the user's accepted guide layout.

Automatic recovery preserves a working document; explicit Library saving is available in Free within its one-comic limit. Neither is a replacement for backing up the complete editable device data.
