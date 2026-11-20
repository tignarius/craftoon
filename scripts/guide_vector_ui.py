"""Vector guide diagrams using the exact icon nodes in the app's Lucide package.

App controls retain the positions mapped from the real iPad viewports. The
PencilKit feature legend is outside the app frame and uses Lucide tool symbols;
it does not imitate the OS-owned palette or embed a screenshot.
"""
from pathlib import Path
import json
from reportlab.lib.colors import HexColor
from reportlab.graphics import renderPDF
from reportlab.graphics.shapes import Drawing, Line, Circle, Ellipse, Rect, PolyLine, Polygon
from reportlab.graphics.svgpath import SvgPath

ROOT = Path(__file__).resolve().parents[1]
NODES = json.loads((ROOT/'docs/manual/app-icons.json').read_text())


def icon(c, name, x, y, size, color, stroke=2):
    c.saveState()
    c.translate(x-size/2,y+size/2)
    c.scale(size/24,-size/24)
    group=Drawing(24,24)
    for kind,attributes in NODES[name]:
        a={k:v for k,v in attributes.items() if k!='key'}
        if kind=='path': shape=SvgPath(a['d'],fillColor=None)
        elif kind=='line': shape=Line(float(a['x1']),float(a['y1']),float(a['x2']),float(a['y2']))
        elif kind=='circle': shape=Circle(float(a['cx']),float(a['cy']),float(a['r']))
        elif kind=='ellipse': shape=Ellipse(float(a['cx']),float(a['cy']),float(a['rx']),float(a['ry']))
        elif kind=='rect': shape=Rect(float(a['x']),float(a['y']),float(a['width']),float(a['height']),rx=float(a.get('rx',0)),ry=float(a.get('ry',a.get('rx',0))))
        elif kind in ('polyline','polygon'):
            points=[float(n) for n in a['points'].replace(',',' ').split()]
            shape=(PolyLine if kind=='polyline' else Polygon)(points)
        else: raise ValueError(kind)
        shape.strokeColor=HexColor(color)
        shape.strokeWidth=stroke
        shape.strokeLineCap=1
        shape.strokeLineJoin=1
        if hasattr(shape, 'fillColor'): shape.fillColor=None
        group.add(shape)
    renderPDF.draw(group,c,0,0)
    c.restoreState()


def box(c,x,y,w,h,fill,stroke=None,r=0):
    c.setFillColor(HexColor(fill))
    c.setStrokeColor(HexColor(stroke or fill))
    c.setLineWidth(.7)
    c.roundRect(x,y,w,h,r,fill=1,stroke=bool(stroke))


def label(c,x,y,value,size=8,color='#64748B',bold=False):
    c.setFillColor(HexColor(color))
    c.setFont('Helvetica-Bold' if bold else 'Helvetica',size)
    c.drawString(x,y,value)


def app_screen(c,orientation,mode,x,y,width,crop=None):
    portrait=orientation=='portrait'
    sw,sh=(681,908) if portrait else (738,552)
    crop=crop or (0,0,sw,sh)
    scale=width/(crop[2]-crop[0])
    height=(crop[3]-crop[1])*scale
    point=lambda sx,sy:(x+(sx-crop[0])*scale,y+height-(sy-crop[1])*scale)
    # Rounded clipping uses the page background, so there is no black corner.
    c.saveState()
    clip=c.beginPath(); clip.roundRect(x,y,width,height,4 if crop==(0,0,sw,sh) else 0)
    c.clipPath(clip,stroke=0,fill=0)
    c.translate(x-crop[0]*scale,y+height+crop[1]*scale)
    c.scale(scale,-scale)
    # Draw native-sized geometry in a top-down coordinate system; invert icon
    # calls locally so their SVG source remains in the correct orientation.
    def top_box(a,b,w,h,fill,stroke=None,r=0): box(c,a,b,w,h,fill,stroke,r)
    def top_icon(name,a,b,size,color,stroke=2):
        c.saveState(); c.translate(a,b); c.scale(1,-1)
        icon(c,name,0,0,size,color,stroke); c.restoreState()
    def top_label(a,b,value,size=8,color='#64748B'):
        c.saveState(); c.translate(a,b); c.scale(1,-1)
        label(c,0,0,value,size,color); c.restoreState()
    top_box(0,0,sw,sh,'#F1F5F9')
    top_box(0,0,sw,59 if portrait else 47,'#FFFFFF')
    top_box(24 if portrait else 17,62 if portrait else 47,
            sw-(48 if portrait else 34),sh-(65 if portrait else 50),'#FFFFFF',r=5)
    xs=[25,64,98,129,161,194,225,257] if portrait else [20,51,80,106,132,157,183,208]
    cy=39 if portrait else 31
    size=14.5 if portrait else 12.8
    top_box(xs[0]-12,cy-12,24,24,'#FFF5E8','#FED7AA',r=7)
    top_icon('square-pen',xs[0],cy,size,'#EA8A23')
    for i,name,color in [(1,'library-big','#8B5CF6'),(2,'glasses','#0D9488'),
                          (3,'file','#647ACB'),(4,'download','#3B82F6'),
                          (5,'grid-2x2','#1ABC9C'),
                          (6,'undo-2','#EA8A23'),(7,'redo-2','#D6CEC4')]:
        top_icon(name,xs[i],cy,size,color,2.5 if name=='download' else 2)
    px=654 if portrait else 715
    top_box(px-14,cy-11,28,22,'#FFFFFF','#E8EDF2',r=5)
    top_label(px-8,cy+3,'1 / 1',8)
    top_icon('plus',sw-10,sh*.533 if portrait else sh*.54,10.5,'#0D9488',2.5)
    left,top,right,bottom=(76,196,586,626) if portrait else (134,122,609,402)
    color='#F39746' if mode=='draw' else '#4ECDC4'
    top_box(left,top,right-left,bottom-top,'#FFFFFF',color)
    centers=(94,567,214) if portrait else (148,594,137)
    lx,rx,py=centers
    for center,name,fg,bg,border in [
        (lx,'pen' if mode=='draw' else 'move','#EA8A23' if mode=='draw' else '#0D9488','#FFF5E8' if mode=='draw' else '#E8FAF6','#FED7AA' if mode=='draw' else '#A7E5DF'),
        (rx,'image' if mode=='draw' else 'trash-2','#EA8A23' if mode=='draw' else '#EF4444','#FFF5E8' if mode=='draw' else '#FEE2E2','#FED7AA' if mode=='draw' else '#FECACA')]:
        top_box(center-10.5,py-10.5,21,21,bg,border,r=10.5)
        top_icon(name,center,py,15,fg)
    if mode=='layout':
        top_box(right-2.5,bottom-2.5,5,5,'#4ECDC4','#FFFFFF',r=2.5)
    c.restoreState()
    return point


def reference(c,x,y,width):
    scale=width/128
    point=lambda sx,sy:(x+sx*scale,y+(45-sy)*scale)
    c.saveState(); c.translate(x,y); c.scale(scale,scale)
    box(c,0,27,128,18,'#FFFFFF','#CBD5E1',r=5)
    label(c,5,33,'Opacity',6)
    box(c,43,35,57,1.6,'#D9D2E6',r=.8)
    box(c,43,35,26,1.6,'#9B83BF',r=.8)
    box(c,66,32.5,6,6,'#FFFFFF','#9B83BF',r=3)
    label(c,107,33,'45%',6)
    box(c,0,0,128,24,'#FFFFFF','#CBD5E1',r=5)
    names=['eye-off','move','rotate-cw','maximize-2','blend','trash-2','check']
    for i,name in enumerate(names):
        cx=12+i*17.2
        if i in (1,4): box(c,cx-7.5,4.5,15,15,'#F1EAFB',r=4)
        icon(c,name,cx,12,10,'#7C3AED' if i in (1,4) else '#B56C76' if i==5 else '#64748B')
    c.restoreState()
    return point


def library(c,x,y,width):
    scale=width/98
    point=lambda sx,sy:(x+sx*scale,y+(33-sy)*scale)
    c.saveState(); c.translate(x,y); c.scale(scale,scale)
    for cx,name,color,bg in [(18,'square-pen','#EA8A23','#FFFFFF'),(49,'glasses','#0D9488','#FFFFFF'),(80,'trash-2','#DC2626','#FEF2F2')]:
        box(c,cx-13,3,26,26,bg,r=9)
        icon(c,name,cx,16,16,color)
    c.restoreState()
    return point


def reader(c,x,y,width,sharing=False):
    sw=58 if sharing else 95
    c.saveState(); c.translate(x,y); c.scale(width/sw,width/sw)
    entries=[(12,'mail','#3B82F6'),(44,'printer','#1ABC9C')] if sharing else [(12,'glasses','#0D9488'),(48,'library-big','#8B5CF6'),(80,'square-pen','#EA8A23')]
    if not sharing: box(c,0,0,25,25,'#E8FAF6','#A7E5DF',r=7)
    for cx,name,color in entries: icon(c,name,cx,12,17,color)
    c.restoreState()


def tool_legend(c,x,y):
    label(c,x,y,'PencilKit',7.5)
    centers=[]
    for i,(name,title) in enumerate([('pen','Pen'),('eraser','Eraser'),('lasso-select','Lasso'),('palette','Colors')]):
        cx=x+84+i*58
        icon(c,name,cx,y+3,10.5,'#64748B')
        label(c,cx+8,y,title,6.8)
        centers.append((cx,y+3))
    return centers[2]
