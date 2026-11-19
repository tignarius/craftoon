# English quick guide

`scripts/build-guide.py` generates one common English, one-page guide at `output/pdf/craftoon-quick-guide.pdf`, copies it to `ios/Craftoon/craftoon-quick-guide.pdf`, and renders `tmp/pdfs/craftoon-quick-guide.png` for visual review. Run it with a Python environment containing reportlab, Pillow, pypdf and PyMuPDF. PDF generation does not build or install the app.

The approved compact page is 595.28 x 659.89 pt. The app bundles only this common PDF and opens it in both orientations. PDFKit fits the whole page after safe-area layout and refits on rotation, preserving pinch zoom while the view bounds remain unchanged. The guide is available offline to Free and Pro users. Older orientation-specific PDFs are historical review artifacts and are not bundled or regenerated.

The three tinted regions distinguish Canvas (orange), Library (purple) and Read (green). Library occupies the space under Layout mode; Read aligns with the lower-right Canvas arm. Canvas shows Layout and Drawing controls, with Background Image Manipulator under Drawing. PencilKit guidance is omitted. Library shows its toolbar and a selected comic with Canvas, Read and Delete actions. Read groups Library/Canvas separately from Email/Print.

All explanatory icons are vectors sourced from the app. Exactly one crop from the existing real `current-library.png` capture is embedded to show a selected comic and its actions. Other historical captures are reference material only. `node scripts/export-guide-icons.mjs` refreshes `app-icons.json` from the installed lucide-react-native package. The Lucide license is attached to the PDF.

The Canvas toolbar follows the app order: Canvas, Library, Read, New, Save, Templates, Undo, Redo, Pages. Templates uses the green grid outline. First mode-icon labels are omitted. Filled arrow tips stay clear of the icons. Add Image is captioned below its icon, matching Switch mode. Library action and Read swipe captions share a baseline.

Free allows up to 4 pages per comic and 1 saved comic at a time. Pro allows unlimited pages and saved comics, plus email and print. FREE uses a teal outline badge; PRO uses purple, with centered lettering. Created by Squareplayer is horizontally centered below the benefits with extra breathing room.
