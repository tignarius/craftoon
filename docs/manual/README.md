# English quick guide

Reviewed 2026-11-20 against application checkpoint `7312da23` and the user-approved PDF layout.

`scripts/build-guide.py` generates one common English, one-page guide at `output/pdf/craftoon-quick-guide.pdf`, copies it to `ios/Craftoon/craftoon-quick-guide.pdf`, and renders `tmp/pdfs/craftoon-quick-guide.png` for visual review. Run it with a Python environment containing reportlab, Pillow, pypdf and PyMuPDF. PDF generation does not build or install the app.

The common page is 595.28 x 871.89 pt. The app bundles only this common PDF and opens it in both orientations. PDFKit fits the whole page after safe-area layout and refits on rotation, preserving pinch zoom while the view bounds remain unchanged. The guide is available offline to Free and Pro users. Older orientation-specific PDFs are historical review artifacts and are not bundled or regenerated.

The three tinted regions distinguish Canvas (orange), Library (purple) and Read (pale blue). Library and Read share the column gap of the Layout and Drawing panels above, with their outer left and right edges aligned to Canvas; Free and Pro benefits occupy a compact card below Read. Canvas shows Layout and Drawing controls, with Background Image Manipulator under Drawing. PencilKit guidance is omitted. Library shows its toolbar and a selected comic with Canvas, Read and Delete actions. Read groups Library/Canvas separately from Email/Print.

Layout mode also shows the artwork-lock button, the border-style button and four closely grouped choices (Solid, Dashed, Dotted, No border), plus a larger vector corner-circle-to-shape-tool diagram with its instructions underneath. Drawing mode shows its actual left-aligned Mode, Zoom and Add Image controls, with a separate Panel zoom card illustrating both zoom states. The taller page gives these additions more room while preserving the three-mode structure and one-page format.

All explanatory icons are vectors sourced from the app. Exactly one crop from the existing real `current-library.png` capture is embedded to show a selected comic and its actions. Other historical captures are reference material only. `node scripts/export-guide-icons.mjs` refreshes `app-icons.json` from the installed lucide-react-native package. The Lucide license is attached to the PDF.

The Canvas toolbar follows the app order: Canvas, Library, Read, New, Save, Templates, Auto arrange, Undo, Redo, Pages. Templates uses the green grid outline. First mode-icon labels are omitted. Filled arrow tips stay clear of the icons. Add Image is captioned below its icon, matching Switch mode. Library selection and Read swipe instructions stay within their respective cards.

Free allows up to 4 pages per comic and 1 saved comic at a time. Pro allows unlimited pages and saved comics, plus email and print. FREE uses a teal outline badge; PRO uses purple, with centered lettering. Created by Squareplayer is horizontally centered at the bottom with extra breathing room.

The extended Layout section adds Auto arrange (the green PanelsTopLeft + Sparkles control) and Lock artwork (the app's Image + LockKeyhole control). Auto arrange uses template spacing while keeping the occupied height and already aligned panels; artwork lock keeps the drawing fixed while panel geometry changes. Reshape instructions now explain that artwork otherwise follows the panel. The original three-mode layout, icon scale, zoom card, Library capture, benefits and centered credit are retained.

The border-style toolbar icon uses three horizontal lines: solid on top, dashed in the middle and dotted at the bottom, all with identical visible endpoints; its four menu choices retain their individual appearances. The artwork-lock overlay sits toward the outer right edge while leaving the circular button outline visible.

Drawing begins lower than Layout to make room for the actual page controls (previous triangle, minus, plus and next triangle) beside the page caption, linked to the single original counter by a filled purple elbow arrow and Click to open label. The menu example is half its earlier size, has no duplicate counter, and uses the exact custom PageArrow triangles plus Lucide minus/plus. Pages is captioned above the original counter with the same downward arrow as the other main controls; the curved connector below it has a shortened horizontal run. Insert or delete pages sits beside the menu; both panels retain the same bottom edge. The Read card is raised to align with Library, and the former full-width benefits footer is placed beneath Read.

The app also supports long-press Library reordering, but the accepted one-page guide still uses its existing selected-cover illustration. No additional drag instructions or new screenshot were inserted during this documentation refresh.
