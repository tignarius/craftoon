"""Build the English one-page guide from real iPad screenshots.

Requires reportlab, pypdf, pymupdf and Pillow. Capture sources live in
`docs/manual/`; both current captures show one empty panel drawn in the app.
Run from the repository root. The finished PDF is also copied into the app.
"""
from pathlib import Path
import shutil
import math
import pymupdf as fitz
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/craftoon-quick-guide.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
c = canvas.Canvas(str(OUT), pagesize=(841.89, 595.28))
c.setTitle('Craftoon | Quick Guide')
c.setAuthor('Squareplayer')
INK, GRAY, PURPLE, TEAL = '#17243B', '#536179', '#7C3AED', '#0D9488'


def text(x, y, value, size=9, color=INK, font='Helvetica'):
    c.setFont(font, size)
    c.setFillColor(HexColor(color))
    c.drawString(x, y, value)


def box(x, y, w, h, fill, radius=8, stroke=None):
    c.setFillColor(HexColor(fill))
    c.setStrokeColor(HexColor(stroke or fill))
    c.setLineWidth(.7)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=bool(stroke))


def badge(x, y):
    box(x, y-2, 25, 13, '#F7F2FF', 4, PURPLE)
    text(x+5, y+1, 'PRO', 7, PURPLE, 'Helvetica-Bold')


def leader(start, end, color=PURPLE, via=()):
    points = [start, *via, end]
    c.setStrokeColor(HexColor(color))
    c.setLineWidth(.75)
    p = c.beginPath()
    p.moveTo(*points[0])
    for point in points[1:]:
        p.lineTo(*point)
    c.drawPath(p)
    # Arrowhead points to the actual control in the screenshot.
    a = math.atan2(end[1]-points[-2][1], end[0]-points[-2][0])
    for delta in [-.5, .5]:
        c.line(end[0], end[1], end[0]-4*math.cos(a+delta), end[1]-4*math.sin(a+delta))


def shot(name, crop, x, y, w):
    image = Image.open(ROOT / f'docs/manual/{name}.png').convert('RGB').crop(crop)
    h = w * image.height / image.width
    c.drawImage(ImageReader(image), x, y, w, h)
    return lambda sx, sy: (x+(sx-crop[0])*w/image.width, y+h-(sy-crop[1])*w/image.width)


def centered(x, y, value, size=8, color=INK, font='Helvetica'):
    text(x-stringWidth(value,font,size)/2, y, value, size, color, font)


# Landscape layout: screenshots remain intact, with callouts outside the screen.
text(30,560,'Craftoon',24,INK,'Helvetica-Bold')
text(30,540,'QUICK GUIDE',13,INK,'Helvetica-Bold')
text(30,523,'iPad',10,GRAY)

screen = Image.open(ROOT / 'docs/manual/blank-panel.png')
assert screen.size == (2752,2064)
# Full screenshot: no reconstructed screen, moved icons or sample artwork.
canvas_point = shot('blank-panel',(0,0,2752,2064),180,140,490)
c.setLineWidth(.7)
c.setStrokeColor(HexColor('#DCE2EA'))
c.rect(180,140,490,367.5,fill=0,stroke=1)

for i,(title,description,sx) in enumerate([
    ('App menu','Guide & codes',75),
    ('Templates','Drag a grid',190),
    ('New','Start a comic',295),
    ('Library','Open comics',390),
    ('Save','Save to Library',489),
    ('Read','Preview',584),
    ('Undo / Redo','Reverse a change',730),
]):
    cx=194+i*71
    if title=='Save':
        text(cx-24,553,title,8.5,INK,'Helvetica-Bold')
        badge(cx+1,551)
    else:
        centered(cx,553,title,8.5,INK,'Helvetica-Bold')
    centered(cx,538,description,7.3,GRAY)
    tx,ty=canvas_point(sx,120)
    leader((cx,529),(tx,ty+7))

# Leaders use actual pixel locations in the unmodified screenshot.
text(30,402,'Panel mode',11,TEAL,'Helvetica-Bold')
for y,label in [(384,'Tap to switch:'),(369,'Layout: move & resize'),(354,'Draw: sketch inside'),(339,'Select strokes: use the lasso')]:
    text(30,y,label,7.7,GRAY)
mx,my=canvas_point(710,642)
leader((153,398),(mx-7,my),TEAL)

text(30,279,'Create a panel',11,TEAL,'Helvetica-Bold')
text(30,263,'Drag on blank paper.',8,GRAY)
tx,ty=canvas_point(1100,1760)
leader((153,270),(tx-5,ty),TEAL,via=[(166,270),(166,ty)])

for title,description,source,cy,color in [
    ('Page menu','Add / delete pages',(2660,120),487,PURPLE),
    ('Delete panel','Remove this panel',(1960,642),394,'#C24A5C'),
    ('Add page','Insert the next page',(2716,1118),309,TEAL),
    ('Resize panel','Drag this handle',(2005,1465),247,TEAL),
]:
    text(704,cy+6,title,10,color,'Helvetica-Bold')
    text(704,cy-10,description,7.8,GRAY)
    tx,ty=canvas_point(*source)
    leader((697,cy),(tx+7,ty),color)

text(30,209,'FREE',8.5,TEAL,'Helvetica-Bold')
text(30,194,'Up to 4 pages per comic.',7.7,GRAY)
badge(30,168)
text(30,151,'Save, export & more pages.',7.7,GRAY)

# Secondary screenshot is only the real Read toolbar of the same empty panel.
text(30,104,'READ & SHARE',10,TEAL,'Helvetica-Bold')
text(30,88,'Open with Read.',8,GRAY)
reader_point=shot('blank-reader',(0,55,2752,175),180,84,490)
for cx,title,sx,description,pro in [
    (196,'App menu',75,'Help & codes',False),
    (300,'Library',195,'Open a comic',False),
    (404,'Edit',295,'Back to Canvas',False),
    (570,'Email',2571,'Attach a PDF',True),
    (670,'Print',2672,'Print your comic',True),
]:
    if pro:
        text(cx-28,58,title,8.5,INK,'Helvetica-Bold')
        badge(cx,56)
    else:
        centered(cx,58,title,8.5,INK,'Helvetica-Bold')
    centered(cx,43,description,7.3,GRAY)
    tx,ty=reader_point(sx,120)
    leader((cx,72),(tx,ty-7))

text(30,18,'Quick guide & activation: app mode icon > Quick guide (PDF) / Enter activation code.',7.5,GRAY)
text(712,18,'Squareplayer / Craftoon',7,GRAY)
c.showPage()
c.save()
reader = PdfReader(OUT)
assert len(reader.pages) == 1
extracted = reader.pages[0].extract_text()
assert not any('\uac00' <= char <= '\ud7a3' for char in extracted)
assert 'Select strokes' in extracted
shutil.copyfile(OUT, ROOT / 'ios/Craftoon/craftoon-quick-guide.pdf')
preview = ROOT / 'tmp/pdfs'
preview.mkdir(parents=True, exist_ok=True)
doc = fitz.open(OUT)
doc.get_page_pixmap(0, matrix=fitz.Matrix(1.8, 1.8)).save(preview / 'craftoon-quick-guide.png')
print(f'Created screenshot-based one-page PDF: {OUT}')
