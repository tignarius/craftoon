"""Build one shared English quick guide with original vector icons.

Requires reportlab, pypdf, PyMuPDF. App layouts retain the mapped control
positions; every icon comes from the app's original Lucide vector nodes.
"""
from pathlib import Path
import math
import shutil
from PIL import Image
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase.pdfmetrics import stringWidth, getAscent
from pypdf import PdfReader, PdfWriter
from guide_vector_ui import app_screen, reference, library, reader as reader_ui, tool_legend, icon as draw_icon, box as draw_box
import pymupdf as fitz

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf'
OUT.mkdir(parents=True, exist_ok=True)
PREVIEW = ROOT / 'tmp/pdfs'
PREVIEW.mkdir(parents=True, exist_ok=True)
PAGE_SIZE = (595.28, 871.89)
INK, GRAY, PURPLE, TEAL = '#17243B', '#536179', '#7C3AED', '#0D9488'
c = None


def text(x, y, value, size=8, color=INK, font='Helvetica'):
    c.setFont(font, size)
    c.setFillColor(HexColor(color))
    c.drawString(x, y, value)


def centered(x, y, value, size=8, color=INK, font='Helvetica'):
    text(x-stringWidth(value, font, size)/2, y, value, size, color, font)


def lines(x, y, values, size=8, leading=12, color=GRAY):
    for i, value in enumerate(values):
        text(x, y-i*leading, value, size, color)


def badge(x, y, value='PRO'):
    width,height=27,13
    bottom=y-3
    font,size='Helvetica-Bold',7
    color=TEAL if value=='FREE' else PURPLE
    fill='#ECFDF5' if value=='FREE' else '#FAF5FF'
    c.setStrokeColor(HexColor(color))
    c.setFillColor(HexColor(fill))
    c.setLineWidth(.8)
    c.roundRect(x,bottom,width,height,4,fill=1,stroke=1)
    # Center the actual all-cap text width and cap height within the outline.
    baseline=bottom+(height-getAscent(font,size))/2
    centered(x+width/2,baseline,value,size,color,font)


def leader(start, end, color=PURPLE, via=(), gap=9, approach=None):
    """Two connected Beziers form a soft elbow; the tip stops before the icon."""
    sx,sy=start
    ex,ey=end
    dx,dy=ex-sx,ey-sy
    if approach is None:
        approach='down' if sy in (541,756) else ('up' if dy>0 else 'down') if abs(dx)<14 else 'right' if dx>0 else 'left'
    vx,vy={'down':(0,-1),'up':(0,1),'right':(1,0),'left':(-1,0)}[approach]
    tx,ty=ex-vx*gap,ey-vy*gap
    p=c.beginPath(); p.moveTo(sx,sy)
    if via:
        mx=via[-1][0]
        my=(sy+ty)/2
        p.curveTo(sx,sy-24,mx,my+24,mx,my)
        if vx==0:
            p.curveTo(mx,ty+24,tx,ty+18,tx,ty)
        else:
            p.curveTo(mx,ty,tx-vx*18,ty,tx,ty)
    elif vx==0:
        mx,my=(sx+tx)/2,(sy+ty)/2
        depth=max(2,min(18,abs(sy-ty)*.38))
        p.curveTo(sx,sy+vy*depth,mx-(tx-sx)*.24,my,mx,my)
        p.curveTo(mx+(tx-sx)*.24,my,tx,ty-vy*depth,tx,ty)
    else:
        mx,my=(sx+tx)/2,(sy+ty)/2
        reach=max(2,min(30,abs(tx-sx)*.38))
        p.curveTo(sx+vx*reach,sy,mx,my-(ty-sy)*.24,mx,my)
        p.curveTo(mx,my+(ty-sy)*.24,tx-vx*reach,ty,tx,ty)
    c.setStrokeColor(HexColor(color)); c.setLineWidth(.72)
    c.setLineCap(1); c.setLineJoin(1)
    c.drawPath(p)
    angle=math.atan2(vy,vx)
    for delta in [-.45,.45]:
        c.line(tx,ty,tx-3.4*math.cos(angle+delta),ty-3.4*math.sin(angle+delta))


def shot(name,crop,x,y,width):
    orientation,mode=name.split('-')
    return app_screen(c,orientation,mode,x,y,width,crop)


def old_shot(name,crop,x,y,width):
    if name=='reference': point=reference(c,x,y,width)
    elif name=='library': point=library(c,x,y,width)
    elif name=='reader':
        reader_ui(c,x,y,width,sharing=crop[0]>1000)
        return None
    else: raise ValueError(name)
    return lambda sx,sy:point(sx-crop[0],sy-crop[1])


def rule(x, y, end):
    c.setStrokeColor(HexColor('#DCE2EA'))
    c.setLineWidth(.6)
    c.line(x, y, end, y)


def landscape():
    text(28,563,'Craftoon',23,INK,'Helvetica-Bold')
    text(28,544,'QUICK GUIDE',12,INK,'Helvetica-Bold')
    text(28,527,'iPad / Landscape / English',8,GRAY)
    pt = shot('landscape-draw',None,180,195,440)
    for i,(label,sx) in enumerate([('Canvas mode',20),('Library',51),('Read',80),
        ('New',106),('Save',132),('Templates',157),('Undo / Redo',195)]):
        cx=190+i*68
        centered(cx,567,label,8,INK,'Helvetica-Bold')
        if label=='Save': badge(cx-13,549)
        tx,ty=pt(sx,31)
        leader((cx,541),(tx,ty),gap=9)
    text(28,454,'1  LAYOUT',10,TEAL,'Helvetica-Bold')
    lines(28,437,['Drag on blank paper','to create a panel.','Or use Templates.'])
    text(28,382,'Panel mode',10,TEAL,'Helvetica-Bold')
    lines(28,366,['Tap the top-left circle','to switch Layout / Draw.'])
    leader((151,378),pt(148,137),TEAL)
    lp=shot('landscape-layout',(134,122,609,402),28,242,125)
    text(28,228,'Drag to move; trash to delete.',7,GRAY)
    text(28,216,'Drag the corner to resize.',7.5,GRAY)
    leader((150,218),lp(608,400),TEAL,gap=4,approach='up')
    text(650,510,'Pages',10,PURPLE,'Helvetica-Bold')
    lines(650,495,['Tap the page counter','for page controls.'])
    leader((640,506),pt(715,31),gap=12)
    text(650,444,'2  DRAW & TRACE',10,TEAL,'Helvetica-Bold')
    lines(650,428,['In Draw, tap the image icon.','Choose Photos or Files.','One reference per panel.'])
    leader((640,438),pt(594,137),TEAL)
    text(650,350,'Select strokes',10,PURPLE,'Helvetica-Bold')
    lines(650,334,["Use PencilKit's lasso.",'Draw around strokes,','then move the selection.'])
    leader((640,344),(380,184),PURPLE,via=[(633,344),(633,217)],approach='down')
    text(650,265,'FREE',8.5,TEAL,'Helvetica-Bold')
    text(650,250,'Create up to 4 pages.',8,GRAY)
    badge(650,228)
    lines(686,231,['More files and pages,','PDF email & print.'],7.5,11)
    tool_legend(c,180,181)
    rule(28,166,814)
    text(28,147,'REFERENCE CONTROLS',9,TEAL,'Helvetica-Bold')
    ref=old_shot('reference',(507,566,635,611),28,70,200)
    for sx,label in [(519,'Eye'),(537,'Move'),(554,'Rotate'),(571,'Scale'),
                     (588,'Opacity'),(605,'Delete'),(622,'Done')]:
        tx,ty=ref(sx,600)
        centered(tx,59,label,6.5,GRAY)
        leader((tx,67),(tx,ty),TEAL,gap=11)
    lines(242,135,['Eye: show / hide.','Done: resume drawing.','Settings: reopen controls.',
                   'Transforms affect only','the reference image.'],7.3,12)
    text(28,40,'Controls appear after import. The slider changes image opacity.',7.3,GRAY)
    text(28,28,'Reference controls stay anchored inside the panel.',7.3,GRAY)
    text(431,147,'LIBRARY',9,PURPLE,'Helvetica-Bold')
    lib=old_shot('library',(408,322,506,355),431,96,116)
    for sx,label in [(426,'Edit'),(457,'Read'),(488,'Delete')]:
        tx,ty=lib(sx,338)
        centered(tx,83,label,7,GRAY)
        leader((tx,91),(tx,ty),gap=13)
    lines(431,65,['Tap a cover for actions.','Tap empty space to deselect.',
                  'Undo restores a deleted comic.'],7.3,12)
    text(592,147,'3  READ & SHARE',9,TEAL,'Helvetica-Bold')
    old_shot('reader',(358,174,453,199),592,113,110)
    old_shot('reader',(1105,174,1163,199),744,113,68)
    lines(592,98,['Left: app menu / Library / Edit.','Right: PDF email / print.'],7.3,12)
    badge(763,84)
    lines(592,65,['Top-left app menu:','Quick guide, unlock / restore Pro,',
                 'activation code & app information.'],7.3,12)
    rule(28,20,814)
    text(28,8,'The drawing palette and available PencilKit tools may vary with iPadOS. Icons: Lucide / ISC.',6.3,GRAY)
    text(692,8,'Craftoon / Squareplayer',6.3,GRAY)


def solid_arrow(start,target,color=PURPLE,gap=15):
    """One filled arrow with a straight, unambiguous axis and a protected tip."""
    sx,sy=start
    dx,dy=target[0]-sx,target[1]-sy
    length=math.hypot(dx,dy)
    if length<=gap+3: raise ValueError('Arrow has insufficient clearance')
    ux,uy=dx/length,dy/length
    nx,ny=-uy,ux
    tx,ty=target[0]-gap*ux,target[1]-gap*uy
    head=min(5.0,(length-gap)*.46)
    bx,by=tx-head*ux,ty-head*uy
    half=0.7
    points=[(sx+nx*half,sy+ny*half),(bx+nx*half,by+ny*half),
            (bx+nx*2.7,by+ny*2.7),(tx,ty),
            (bx-nx*2.7,by-ny*2.7),(bx-nx*half,by-ny*half),
            (sx-nx*half,sy-ny*half)]
    path=c.beginPath(); path.moveTo(*points[0])
    for point in points[1:]: path.lineTo(*point)
    path.close()
    c.setFillColor(HexColor(color)); c.drawPath(path,fill=1,stroke=0)


def portrait_header(mode,x,y,width=535):
    """Only the app's upper control strip; left/right groups keep their order."""
    draw_box(c,x,y,width,48,'#FFFFFF','#DFE6EE',r=7)
    draw_box(c,x+1,y+1,width-2,5,'#F1F5F9',r=2)
    cy=y+25
    if mode=='canvas':
        centers=[x+24,x+76,x+128,x+180,x+232,x+284,x+336,x+388,x+432]
        entries=[('square-pen','#EA8A23'),('library-big','#8B5CF6'),
                 ('glasses','#0D9488'),('file','#647ACB'),
                 ('download','#3B82F6'),('grid-2x2','#1ABC9C'),
                 ('auto-arrange','#1ABC9C'),('undo-2','#EA8A23'),('redo-2','#CFC7BD')]
        draw_box(c,centers[0]-15,cy-15,30,30,'#FFF5E8','#FED7AA',r=8)
        for cx,(name,color) in zip(centers,entries):
            if name=='auto-arrange': auto_arrange_glyph(cx,cy,20)
            else: draw_icon(c,name,cx,cy,20,color,2.5 if name=='download' else 2)
        page=(x+width-29,cy)
        draw_box(c,page[0]-18,cy-13,36,26,'#FFFFFF','#E8EDF2',r=6)
        centered(page[0],cy-3,'1 / 1',8.5,GRAY)
        return [(cx,cy) for cx in centers]+[page]
    if mode=='library':
        centers=[x+24,x+80,x+width-78,x+width-26]
        entries=[('library-big','#8B5CF6'),('square-pen','#EA8A23'),
                 ('mail','#3B82F6'),('printer','#1ABC9C')]
        draw_box(c,centers[0]-15,cy-15,30,30,'#F3EDFF','#DACAF4',r=8)
        for cx,(name,color) in zip(centers,entries): draw_icon(c,name,cx,cy,20,color)
        return [(cx,cy) for cx in centers]
    centers=[x+24,x+68,x+110,x+width-64,x+width-22]
    entries=[('glasses','#0D9488'),('library-big','#8B5CF6'),
             ('square-pen','#EA8A23'),('mail','#3B82F6'),('printer','#1ABC9C')]
    draw_box(c,centers[0]-15,cy-15,30,30,'#E8FAF6','#A7E5DF',r=8)
    for cx,(name,color) in zip(centers,entries): draw_icon(c,name,cx,cy,20,color)
    return [(cx,cy) for cx in centers]


def border_style_glyph(cx, cy, style='solid', size=19, color='#3B82F6'):
    # Match the mixed-style toolbar icon and the four menu choices.
    c.saveState(); c.translate(cx-size/2,cy+size/2); c.scale(size/24,-size/24)
    c.setStrokeColor(HexColor(color)); c.setLineWidth(1.8)
    if style == 'mixed':
        c.setLineCap(1); c.line(3,5,21,5)
        c.setFillColor(HexColor(color))
        # Explicit marks match the solid line's round-cap extent: 2.1..21.9.
        for x in [2.1,9.7,17.3]: c.rect(x,11.1,4.6,1.8,stroke=0,fill=1)
        for x in [3,6.6,10.2,13.8,17.4,21]: c.circle(x,19,.9,stroke=0,fill=1)
        c.restoreState()
        return
    if style == 'dashed': c.setDash(5,3)
    elif style in ('dotted','none'): c.setDash(1,3)
    if style == 'dotted': c.setLineCap(1)
    if style == 'none': c.setStrokeAlpha(.45)
    c.roundRect(3,4,18,16,1,stroke=1,fill=0)
    if style == 'none':
        c.setDash(); c.setStrokeAlpha(1); c.setLineWidth(2); c.line(3,22,21,2)
    c.restoreState()


def reshape_glyph(cx,cy,size=19):
    # Exact polygon and highlighted corner from PanelCornerHandle.tsx.
    c.saveState(); c.translate(cx-size/2,cy+size/2); c.scale(size/28,-size/28)
    p=c.beginPath(); p.moveTo(8,5); p.lineTo(20,5); p.lineTo(24,22); p.lineTo(4,22); p.close()
    c.setFillColor(HexColor('#FFFFFF')); c.setStrokeColor(HexColor('#3B82F6')); c.setLineWidth(1.8)
    c.drawPath(p,stroke=1,fill=1)
    c.setFillColor(HexColor('#3B82F6')); c.setStrokeColor(HexColor('#FFFFFF')); c.setLineWidth(1.5)
    c.circle(24,22,3,stroke=1,fill=1)
    c.restoreState()


def auto_arrange_glyph(cx,cy,size=20,background='#FFFFFF'):
    draw_icon(c,'panels-top-left',cx,cy,size,'#1ABC9C')
    draw_box(c,cx+size*.27,cy+size*.27,size*.7,size*.7,background,r=2)
    draw_icon(c,'sparkles',cx+size*.5,cy+size*.5,size*14/22,'#1ABC9C',2.2)


def artwork_lock_glyph(cx,cy,size=16,locked=False):
    color='#FFFFFF' if locked else '#3B82F6'
    background='#3B82F6' if locked else '#FFFFFF'
    # Match the app's overlapping Image and LockKeyhole symbols.
    draw_icon(c,'image',cx-size*.1,cy+size*.1,size*.8,color,2.2)
    draw_box(c,cx-size*.02,cy-size*.42,size*.62,size*.62,background,r=1)
    draw_icon(c,'lock-keyhole' if locked else 'lock-keyhole-open',
              cx+size*.26,cy-size*.14,size*.55,color,2.6)


def panel_top(x,y,width,mode):
    """Current panel tool positions: mode and tools on left, Layout trash on right."""
    layout=mode=='layout'
    border='#3B82F6' if layout else '#F97316'
    draw_box(c,x,y,width,38,'#FAFCFE',r=3)
    c.setStrokeColor(HexColor(border)); c.setLineWidth(.9)
    p=c.beginPath(); p.moveTo(x,y); p.lineTo(x,y+38)
    p.lineTo(x+width,y+38); p.lineTo(x+width,y); c.drawPath(p)
    cy=y+21
    centers=[x+23,x+63,x+96,x+width-23] if layout else [x+23,x+63,x+96]
    names=['move','border','artwork-lock','trash-2'] if layout else ['pen','zoom-in','image']
    for cx,name in zip(centers,names):
        color='#EF4444' if name=='trash-2' else border
        draw_box(c,cx-11,cy-11,22,22,'#FFFFFF',color,r=11)
        if name=='border': border_style_glyph(cx,cy,style='mixed',size=16,color=color)
        elif name=='artwork-lock':
            artwork_lock_glyph(cx,cy)
            c.setStrokeColor(HexColor(color)); c.setLineWidth(.7); c.circle(cx,cy,11,stroke=1,fill=0)
        else: draw_icon(c,name,cx,cy,16,color,2.2)
    return [(cx,cy) for cx in centers]


def layout_extras():
    # Keep the four alternatives together as a compact visual choice set.
    for cx,style,label in zip([52,86,120,154],['solid','dashed','dotted','none'],['Solid','Dashed','Dotted','No border']):
        border_style_glyph(cx,551,style,size=20)
        centered(cx,531,label,7.2,GRAY)
    text(40,505,'Resize / reshape',8.5,'#3B82F6','Helvetica-Bold')
    c.setStrokeColor(HexColor('#3B82F6')); c.setLineWidth(1.2)
    p=c.beginPath(); p.moveTo(48,493); p.lineTo(97,493); p.lineTo(116,465); p.lineTo(48,465); p.close()
    c.drawPath(p,stroke=1,fill=0)
    c.setFillColor(HexColor('#FFFFFF')); c.circle(116,465,5,stroke=1,fill=1)
    solid_arrow((133,478),(157,478),'#3B82F6',gap=1)
    reshape_glyph(181,478,27)
    text(40,445,'Click the corner circle to switch tools.',7.5,GRAY)
    text(40,432,'Drag the shape tool left or right to reshape.',7.5,GRAY)
    text(40,419,'Artwork follows the panel unless locked.',7.5,GRAY)

    auto_arrange_glyph(55,390,20,background='#F1FBF8')
    text(80,400,'Auto arrange',8.5,'#0D9488','Helvetica-Bold')
    lines(80,386,['Tidy rough panels with template spacing.',
                  'Keep the occupied height and aligned panels.'],7.5,12)

    draw_box(c,43,330,24,24,'#3B82F6','#3B82F6',r=12)
    artwork_lock_glyph(55,342,17,locked=True)
    text(80,350,'Lock artwork',8.5,'#3B82F6','Helvetica-Bold')
    lines(80,336,['Keep artwork fixed while editing the panel.',
                  'Click again to unlock.'],7.5,12)


def panel_zoom():
    draw_box(c,314,498,239,63,'#FFFBF5','#F0D2A9',r=7)
    text(324,545,'Panel zoom',8.5,'#B76D20','Helvetica-Bold')
    for cx,name in [(335,'zoom-in'),(379,'zoom-out')]:
        draw_box(c,cx-12,522-12,24,24,'#FFFFFF','#F97316',r=12)
        draw_icon(c,name,cx,522,17,'#F97316',2.2)
    solid_arrow((351,522),(363,522),'#B76D20',gap=1)
    text(401,531,'Enlarge only this panel.',7.5,GRAY)
    text(401,517,'Click again to return.',7.5,GRAY)


def rounded_region(points,fill,border,r=9):
    # Rounded orthogonal outline, including the concave corners of nested mode cards.
    path=c.beginPath()
    k=.55228475
    for i,(x,y) in enumerate(points):
        prev=points[i-1]; nxt=points[(i+1)%len(points)]
        da=math.hypot(prev[0]-x,prev[1]-y)
        db=math.hypot(nxt[0]-x,nxt[1]-y)
        radius=min(r,da/2,db/2)
        a=(x+(prev[0]-x)*radius/da,y+(prev[1]-y)*radius/da)
        b=(x+(nxt[0]-x)*radius/db,y+(nxt[1]-y)*radius/db)
        if i==0: path.moveTo(*a)
        else: path.lineTo(*a)
        path.curveTo(a[0]+k*(x-a[0]),a[1]+k*(y-a[1]),
                     b[0]+k*(x-b[0]),b[1]+k*(y-b[1]),*b)
    path.close()
    c.setFillColor(HexColor(fill)); c.setStrokeColor(HexColor(border)); c.setLineWidth(.7)
    c.drawPath(path,fill=1,stroke=1)


def mode_card(x,y,width,height,mode,number,title,outline=None):
    modes={
        'canvas':('square-pen','#EA8A23','#FFF8EF','#F1D8BC','#FFF5E8'),
        'library':('library-big','#8B5CF6','#F6F1FF','#DACAF4','#F3EDFF'),
        'reader':('glasses','#0D9488','#EDF9F5','#BBDFD5','#E8FAF6'),
    }
    name,color,fill,border,badge_fill=modes[mode]
    if outline: rounded_region(outline,fill,border)
    else: draw_box(c,x,y,width,height,fill,border,r=10)
    cy=y+height-25
    draw_box(c,x+10,cy-15,30,30,badge_fill,border,r=8)
    draw_icon(c,name,x+25,cy,20,color)
    text(x+49,cy-4,f'{number}  {title}',12,INK,'Helvetica-Bold')


def mode_sentence(x,y,name,explanation,color):
    text(x,y,name,8.5,color,'Helvetica-Bold')
    dx=stringWidth(name,'Helvetica-Bold',8.5)+4
    text(x+dx,y,explanation,8.1,GRAY)


def selected_comic(x,y,width):
    # Actual library capture: one selected comic, including its action overlay.
    # Crop only the existing card; never reconstruct or repaint its contents.
    image=Image.open(ROOT/'docs/manual/current-library.png').convert('RGB').crop((8,62,203,355))
    height=width*image.height/image.width
    c.saveState()
    clip=c.beginPath(); clip.roundRect(x,y,width,height,4)
    c.clipPath(clip,fill=0,stroke=0)
    c.drawImage(ImageReader(image),x,y,width,height)
    c.restoreState()


def portrait():
    c.saveState()
    c.translate(0,30)
    text(30,802,'Craftoon',23,INK,'Helvetica-Bold')
    text(565-stringWidth('QUICK GUIDE','Helvetica-Bold',11),804,'QUICK GUIDE',11,INK,'Helvetica-Bold')

    # Three tinted mode cards. Each leading mode symbol is exactly 20 pt,
    # matching the app control symbols in the toolbar illustrations below.
    mode_card(22,305,551,470,'canvas','01','CANVAS')
    mode_card(22,25,266,272,'library','02','LIBRARY')
    mode_card(296,103,277,194,'reader','03','READ')

    targets=portrait_header('canvas',34,667,527)
    for target,label in list(zip(targets,['Canvas mode','Library','Read','New','Save','Templates','Auto arrange','Undo','Redo','Pages']))[1:]:
        centered(target[0],727,label,7.3,INK,'Helvetica-Bold')
        solid_arrow((target[0],720),target,gap=18)

    # The extended orange Drawing group owns the Background Image controls.
    draw_box(c,30,313,264,348,'#F1FBF8','#D3EBE3',r=7)
    draw_box(c,304,313,259,348,'#FFF1DF','#F0D2A9',r=7)
    mode_sentence(40,646,'Layout mode:','Create and arrange panels.',TEAL)
    mode_sentence(314,646,'Drawing mode:','Draw inside a panel.','#B76D20')
    layout=panel_top(40,600,244,'layout')
    drawing=panel_top(314,600,239,'draw')
    for target,label in zip(layout+drawing,['Switch mode','Border style','Lock artwork','Delete panel','Switch mode','Zoom','Add image']):
        caption_x=target[0]
        if label in ('Border style','Lock artwork'):
            first,second=label.split(' ')
            centered(caption_x,580,first,7,GRAY)
            centered(caption_x,570,second,7,GRAY)
        else: centered(caption_x,580,label,7,GRAY)
        solid_arrow((caption_x,590),target,TEAL,gap=13)
    layout_extras()
    panel_zoom()
    text(314,475,'Background Image Manipulator',7.2,'#B76D20','Helvetica-Bold')
    ref=reference(c,314,380,239)
    for i,label in enumerate(['Show / hide','Move','Rotate','Scale','Opacity','Delete','Done']):
        target=ref(12+i*17.2,33)
        centered(target[0],367,label,5.8,GRAY)
        solid_arrow((target[0],376),target,TEAL,gap=14)

    c.saveState(); c.translate(0,-112)
    # Real Library header, with the selected comic alongside compact actions.
    targets=portrait_header('library',34,291,242)
    for target,label in list(zip(targets,['Library mode','Canvas','Email','Print']))[1:]:
        centered(target[0],357,label,7.3,INK,'Helvetica-Bold')
        solid_arrow((target[0],347),target,gap=18)
    badge(targets[2][0]-13,292)
    badge(targets[3][0]-13,292)
    selected_comic(34,147,76)
    actions=[(153,'square-pen','Canvas','#EA8A23'),
             (197,'glasses','Read','#0D9488'),
             (241,'trash-2','Delete','#DC2626')]
    for cx,name,title,color in actions:
        if name=='trash-2': draw_box(c,cx-15,213-15,30,30,'#FEF2F2',r=9)
        draw_icon(c,name,cx,213,20,color)
        centered(cx,246,title,8,INK,'Helvetica-Bold')
        solid_arrow((cx,236),(cx,213),gap=17)
    centered(sum(item[0] for item in actions)/len(actions),181,'Click a comic to show its actions.',8,GRAY)

    c.saveState(); c.translate(0,78)
    targets=portrait_header('reader',308,215,253)
    for target,label in list(zip(targets,['Read mode','Library','Canvas','Email','Print']))[1:]:
        centered(target[0],280,label,6.8,INK,'Helvetica-Bold')
        solid_arrow((target[0],270),target,gap=18)
    badge(targets[3][0]-13,216)
    badge(targets[4][0]-13,216)
    text(308,181,'Swipe to turn pages.',8,GRAY)
    c.restoreState()
    c.restoreState()

    # Benefits occupy the space beneath the raised Read card.
    draw_box(c,296,25,277,70,'#F8FAFC','#DFE6EE',r=8)
    badge(308,71,'FREE')
    lines(343,78,['Up to 4 pages per comic','Save 1 comic at a time'],7.3,12)
    badge(308,38)
    lines(343,45,['Unlimited pages per comic','Save unlimited comics | Email & Print'],7.3,12)
    c.restoreState()
    centered(595.28/2,13,'Created by Squareplayer',6.5,GRAY)


# One common English guide is shared by portrait and landscape app views.
path=OUT / 'craftoon-quick-guide.pdf'
c=canvas.Canvas(str(path),pagesize=PAGE_SIZE,pageCompression=1)
c.setTitle('Craftoon | Quick Guide')
c.setAuthor('Squareplayer')
portrait()
c.showPage()
c.save()
writer=PdfWriter()
writer.clone_document_from_reader(PdfReader(path))
writer.add_attachment("lucide-LICENSE.txt",(ROOT/"docs/manual/lucide-LICENSE.txt").read_bytes())
with path.open("wb") as stream: writer.write(stream)
document=PdfReader(path)
assert len(document.pages)==1
page=document.pages[0]
extracted=' '.join(page.extract_text().split())
assert not any('\uac00'<=char<='\ud7a3' for char in extracted)
expected_labels=['Auto arrange','Lock artwork','Artwork follows the panel unless locked.','CANVAS','Border style','Resize / reshape','Solid','Dashed','Dotted','No border','Zoom','Panel zoom','Enlarge only this panel.','Click again to return.','Layout mode:','Drawing mode:','Background Image Manipulator','LIBRARY','READ','Opacity','Canvas','FREE','Up to 4 pages per comic','Save 1 comic at a time','Unlimited pages per comic','Save unlimited comics']
assert 'PencilKit' not in extracted
for expected in expected_labels:
    assert expected in extracted,expected
assert (float(page.mediabox.width),float(page.mediabox.height)) == PAGE_SIZE
shutil.copyfile(path,ROOT / f'ios/Craftoon/{path.name}')
doc=fitz.open(str(path))
assert len(doc[0].get_images())==1, "Only the selected-comic capture may be rasterized"
doc[0].get_pixmap(matrix=fitz.Matrix(2,2)).save(str(PREVIEW / f'{path.stem}.png'))
print(f'Created {path} ({path.stat().st_size:,} bytes), one English page shared by both orientations')
