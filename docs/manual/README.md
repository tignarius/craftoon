# English quick guide

`scripts/build-guide.py` generates one common English, one-page guide at `output/pdf/craftoon-quick-guide.pdf`, copies it to `ios/Craftoon/craftoon-quick-guide.pdf`, and renders `tmp/pdfs/craftoon-quick-guide.png` for visual review. Run it with a Python environment containing reportlab, Pillow, pypdf and PyMuPDF. PDF generation does not build or install the app.

The common page is 595.28 x 759.89 pt. The app bundles only this common PDF and opens it in both orientations. PDFKit fits the whole page after safe-area layout and refits on rotation, preserving pinch zoom while the view bounds remain unchanged. The guide is available offline to Free and Pro users. Older orientation-specific PDFs are historical review artifacts and are not bundled or regenerated.

The three tinted regions distinguish Canvas (orange), Library (purple) and Read (green). Library occupies the space under Layout mode; Read aligns with the lower-right Canvas arm. Canvas shows Layout and Drawing controls, with Background Image Manipulator under Drawing. PencilKit guidance is omitted. Library shows its toolbar and a selected comic with Canvas, Read and Delete actions. Read groups Library/Canvas separately from Email/Print.

Layout mode also shows the border-style button and four closely grouped choices (Solid, Dashed, Dotted, No border), plus a larger vector corner-circle-to-shape-tool diagram with its instructions underneath. Drawing mode shows its actual left-aligned Mode, Zoom and Add Image controls, with a separate Panel zoom card illustrating both zoom states. The taller page gives these additions more room while preserving the three-mode structure and one-page format.

All explanatory icons are vectors sourced from the app. Exactly one crop from the existing real `current-library.png` capture is embedded to show a selected comic and its actions. Other historical captures are reference material only. `node scripts/export-guide-icons.mjs` refreshes `app-icons.json` from the installed lucide-react-native package. The Lucide license is attached to the PDF.

The Canvas toolbar follows the app order: Canvas, Library, Read, New, Save, Templates, Undo, Redo, Pages. Templates uses the green grid outline. First mode-icon labels are omitted. Filled arrow tips stay clear of the icons. Add Image is captioned below its icon, matching Switch mode. Library action and Read swipe captions share a baseline.

Free allows up to 4 pages per comic and 1 saved comic at a time. Pro allows unlimited pages and saved comics, plus email and print. FREE uses a teal outline badge; PRO uses purple, with centered lettering. Created by Squareplayer is horizontally centered below the benefits with extra breathing room.
