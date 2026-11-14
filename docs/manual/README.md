# Quick-guide screenshot sources

The current guide uses only these real 2752 × 2064 landscape iPad simulator captures:

- `blank-panel.png`: Craftoon Canvas with one empty panel, created by dragging in the running app. The panel is selected so its mode button, delete button and resize handle are visible.
- `blank-reader.png`: Read mode for the same comic with the same empty panel. Only the actual toolbar is used in the guide.

There is no drawn artwork, sample comic or generated app screen in the current PDF. The Canvas capture is placed in full. Its icons are not moved, recreated or substituted. English callouts and outlined PRO badges are PDF elements outside the capture, with arrow endpoints measured against the original screenshot pixels.

`scripts/build-guide.py` creates a single A4 landscape PDF at `output/pdf/craftoon-quick-guide.pdf` and copies the same file to `ios/Craftoon/craftoon-quick-guide.pdf` for the in-app guide.

The older `canvas.png`, `layout.png`, `draw.png`, `select.png` and `reader.png` captures are not used by the current generator.
