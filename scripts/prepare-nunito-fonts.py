"""Freeze the approved Nunito Sans preview at its default optical size.

Requires fonttools. Source and OFL license come from google/fonts/ofl/nunitosans.
"""
from pathlib import Path
from shutil import copyfile
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parent.parent
source = root / 'output/typography/fonts/NunitoSans.ttf'
ios = root / 'ios/Craftoon/Fonts'
android = root / 'android/app/src/main/assets/fonts'
for folder in (ios, android):
    folder.mkdir(parents=True, exist_ok=True)
for weight, style in [(400, 'Regular'), (500, 'Medium'), (600, 'SemiBold'),
                      (700, 'Bold'), (800, 'ExtraBold'), (900, 'Black')]:
    font = instantiateVariableFont(TTFont(source),
        {'wght': weight, 'wdth': 100, 'opsz': 12, 'YTLC': 500}, inplace=True)
    # Give static faces a shared family and conventional PostScript names so
    # UIKit/React Native resolve fontWeight without synthetic bold or fallback.
    names = {1: 'Nunito Sans', 2: style,
             3: f'Craftoon:NunitoSans-{style}:1',
             4: f'Nunito Sans {style}', 6: f'NunitoSans-{style}',
             16: 'Nunito Sans', 17: style}
    for name_id, value in names.items():
        font['name'].removeNames(nameID=name_id)
        font['name'].setName(value, name_id, 3, 1, 0x409)
        font['name'].setName(value, name_id, 1, 0, 0)
    font['OS/2'].usWeightClass = weight
    font['OS/2'].fsSelection &= ~((1 << 0) | (1 << 5) | (1 << 6))
    if weight >= 700:
        font['OS/2'].fsSelection |= 1 << 5
    elif weight == 400:
        font['OS/2'].fsSelection |= 1 << 6
    font['head'].macStyle = 1 if weight >= 700 else 0
    path = ios / f'NunitoSans-{style}.ttf'
    font.save(path)
    copyfile(path, android / path.name)
copyfile(root / 'output/typography/fonts/nunitosans-OFL.txt', ios / 'OFL.txt')
