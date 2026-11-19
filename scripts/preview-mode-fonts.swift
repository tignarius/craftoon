import AppKit
import CoreText

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let output = root.appendingPathComponent("output/typography")
for name in ["Inter", "Roboto", "OpenSans", "NunitoSans"] {
    let url = output.appendingPathComponent("fonts/\(name).ttf")
    var error: Unmanaged<CFError>?
    guard CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) else {
        fatalError("Font registration failed: \(name)")
    }
}
struct Choice {
    let name: String
    let family: String
    let note: String
}
let choices = [
    Choice(name: "SF Pro", family: "system", note: "Clean / native iOS"),
    Choice(name: "SF Pro Rounded", family: "rounded", note: "Soft / friendly"),
    Choice(name: "Helvetica Neue", family: "Helvetica Neue", note: "Classic / restrained"),
    Choice(name: "Avenir Next", family: "Avenir Next", note: "Warm / geometric"),
    Choice(name: "Inter", family: "Inter", note: "Crisp / compact"),
    Choice(name: "Roboto", family: "Roboto", note: "Familiar / practical"),
    Choice(name: "Open Sans", family: "Open Sans", note: "Open / readable"),
    Choice(name: "Nunito Sans", family: "Nunito Sans", note: "Gentle / approachable"),
]
func color(_ hex: UInt32) -> NSColor {
    NSColor(srgbRed: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255,
            blue: CGFloat(hex & 255) / 255, alpha: 1)
}
let ink = color(0x0F172A), muted = color(0x64748B), purple = color(0x7C3AED)
func font(_ choice: Choice, _ size: CGFloat, _ weight: Int = 400) -> NSFont {
    if choice.family == "system" || choice.family == "rounded" {
        let w: NSFont.Weight = weight >= 700 ? .bold : weight >= 600 ? .semibold : weight >= 500 ? .medium : .regular
        let base = NSFont.systemFont(ofSize: size, weight: w)
        if choice.family == "rounded" {
            guard let d = base.fontDescriptor.withDesign(.rounded), let f = NSFont(descriptor: d, size: size) else {
                fatalError("Rounded system font unavailable")
            }
            return f
        }
        return base
    }
    let w = weight >= 700 ? 9 : weight >= 600 ? 8 : weight >= 500 ? 6 : 5
    guard let f = NSFontManager.shared.font(withFamily: choice.family, traits: [], weight: w, size: size), f.familyName == choice.family else {
        fatalError("Exact family unavailable: \(choice.family)")
    }
    return f
}
let labelFont = Choice(name: "SF Pro", family: "system", note: "")
var surfaceHeight: CGFloat = 1180
func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> NSRect {
    NSRect(x: x, y: surfaceHeight-y-h, width: w, height: h)
}
func box(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ radius: CGFloat,
         _ fill: NSColor, stroke: NSColor? = nil) {
    let p = NSBezierPath(roundedRect: rect(x,y,w,h), xRadius: radius, yRadius: radius)
    fill.setFill(); p.fill()
    if let stroke = stroke { stroke.setStroke(); p.lineWidth=0.7; p.stroke() }
}
func text(_ value: String, _ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ choice: Choice,
          _ size: CGFloat, _ weight: Int = 400, _ tint: NSColor = ink,
          _ align: NSTextAlignment = .left, kern: CGFloat = 0) {
    let p = NSMutableParagraphStyle(); p.alignment = align; p.lineBreakMode = .byTruncatingTail
    let attr: [NSAttributedString.Key: Any] = [.font: font(choice,size,weight), .foregroundColor: tint, .paragraphStyle: p, .kern: kern]
    (value as NSString).draw(in: rect(x,y,w,size*1.6), withAttributes: attr)
}
func rule(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat) {
    box(x,y,w,0.6,0,color(0xE2E8F0))
}
func drawCard(_ c: Choice, _ index: Int, _ x: CGFloat, _ y: CGFloat) {
    text("\(index+1).  \(c.name)",x,y-38,320,labelFont,22,600)
    box(x,y,320,370,16,.white,stroke:color(0xE2E8F0))
    box(x+16,y+16,34,34,9,color(0xFFF5E8))
    // Small mode mark, identical across all previews.
    let pencil = NSBezierPath()
    pencil.move(to:NSPoint(x:x+26,y:surfaceHeight-(y+39)))
    pencil.line(to:NSPoint(x:x+40,y:surfaceHeight-(y+25)))
    color(0xEA8A23).setStroke(); pencil.lineWidth=2.5; pencil.lineCapStyle = .round; pencil.stroke()
    text("CURRENT MODE",x+60,y+14,216,c,9,700,color(0x94A3B8),kern:1)
    text("Canvas mode",x+60,y+29,216,c,17,700)
    text("×",x+282,y+17,22,labelFont,22,400,muted,.center)
    rule(x,y+66,320)
    text("Quick guide (PDF)",x+16,y+81,288,c,14,600,purple)
    rule(x,y+114,320)
    text("Craftoon",x+16,y+126,215,c,15,600)
    box(x+251,y+124,53,22,6,color(0xF1F5F9),stroke:color(0xE2E8F0))
    text("Free",x+251,y+127,53,c,12,700,color(0x475569),.center)
    text("Version",x+16,y+155,200,c,12,400,muted)
    text("1.0",x+235,y+155,69,c,12,500,color(0x334155),.right)
    rule(x,y+180,320)
    box(x+16,y+194,288,44,9,purple)
    text("Unlock Pro",x+16,y+207,288,c,14,700,.white,.center)
    text("Restore purchases",x+16,y+248,288,c,12,500,purple,.center)
    rule(x,y+278,320)
    text("Enter activation code",x+16,y+295,288,c,14,600,purple)
    rule(x,y+326,320)
    text("About Craftoon",x+16,y+342,168,c,12,400,muted)
    text("Squareplayer",x+182,y+342,122,c,12,500,color(0x334155),.right)
    text("Aa Bb Rg 0123456789",x,y+389,320,c,18,400)
    text(c.note,x,y+420,320,labelFont,12,400,muted)
}
func render(_ width: Int, _ height: Int, _ path: URL, _ body: () -> Void) {
    let scale: CGFloat = 2
    surfaceHeight = CGFloat(height)
    let rep = NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:width*2,pixelsHigh:height*2,
        bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep:rep)
    NSGraphicsContext.current!.cgContext.scaleBy(x:scale,y:scale)
    body()
    NSGraphicsContext.restoreGraphicsState()
    try! rep.representation(using:.png,properties:[:])!.write(to:path)
}
render(1536,1180,output.appendingPathComponent("craftoon-mode-font-comparison.png")) {
    box(0,0,1536,1180,0,color(0xEEF2F7))
    text("Craftoon / Mode menu typography",56,24,1424,labelFont,30,700)
    text("Eight real font families. Same copy, sizes, weights and colors. Preview only.",56,70,1424,labelFont,14,400,muted)
    for (i,c) in choices.enumerated() {
        drawCard(c,i,56+CGFloat(i%4)*368,150+CGFloat(i/4)*540)
    }
    text("Title 17 pt / Menu 14 pt / Details 12 pt   |   Current app font: Chalkboard SE",56,1144,1424,labelFont,12,400,muted)
}
for (i,c) in choices.enumerated() {
    render(368,492,output.appendingPathComponent(String(format:"%02d-",i+1)+c.name.lowercased().replacingOccurrences(of:" ",with:"-")+".png")) {
        box(0,0,368,492,0,color(0xEEF2F7)); drawCard(c,i,24,56)
    }
    print("\(i+1). \(c.name): \(font(c,14).fontName) / \(font(c,17,700).fontName)")
}
print("Rendered 8 font menus and comparison PNG.")
