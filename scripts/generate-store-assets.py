#!/usr/bin/env python3
"""
Generates Chrome Web Store listing assets into assets/.

Mockups, not captures — they depict the real UI (palettes and control order are
taken from src/content/content.css and src/settings/settings.css) but are drawn
programmatically. For an actual store submission prefer real screenshots; the
Chrome Web Store expects listing images to show genuine functionality.

Requires Pillow:  pip install Pillow
Usage:            python3 scripts/generate-store-assets.py
"""

import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

# Supersample factor — Pillow does not antialias shape edges, so everything is
# drawn at 2x and downscaled with LANCZOS at save time.
S = 2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")

# ── Palette (mirrors src/content/content.css :root) ─────────────────────────
BG_DARK = (26, 10, 46)        # #1A0A2E
PURPLE = (124, 58, 237)       # #7C3AED
LAVENDER = (167, 139, 250)    # #A78BFA
PALE = (221, 214, 254)        # #DDD6FE
GOLD = (252, 211, 77)         # #FCD34D
TEXT = (245, 243, 255)        # #F5F3FF
MUTED = (196, 181, 253)       # #C4B5FD
SET_BG = (15, 7, 32)          # #0f0720 — settings page body
SET_SECTION = (26, 10, 46)    # #1a0a2e — settings section card

WHITE = (255, 255, 255)
INK = (32, 33, 36)
GREY_TEXT = (95, 99, 104)
CHROME_BAR = (222, 225, 230)
CHROME_TAB = (255, 255, 255)
CHROME_URL = (241, 243, 244)

F_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
F_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def font(size, bold=False):
    return ImageFont.truetype(F_BOLD if bold else F_REG, int(size * S))


def canvas(w, h, bg):
    return Image.new("RGBA", (w * S, h * S), bg + (255,))


def gradient_bg(w, h, top, bottom):
    """Vertical gradient — a flat two-tone split leaves a visible seam."""
    img = Image.new("RGBA", (w * S, h * S))
    d = ImageDraw.Draw(img)
    for i in range(h * S):
        t = i / (h * S - 1)
        d.line([(0, i), (w * S, i)],
               fill=tuple(int(top[c] + (bottom[c] - top[c]) * t) for c in range(3)) + (255,))
    return img


def text_w(d, s, f):
    return d.textlength(s, font=f) / S


def shadow(base, box, radius, blur=14, offset=(0, 6), alpha=90):
    """Soft drop shadow behind a rounded rect, composited onto base."""
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = box
    ld.rounded_rectangle(
        [(x0 + offset[0]) * S, (y0 + offset[1]) * S,
         (x1 + offset[0]) * S, (y1 + offset[1]) * S],
        radius=radius * S, fill=(0, 0, 0, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(blur * S / 2))
    return Image.alpha_composite(base, layer)


def speaker(d, cx, cy, r, color):
    """Speaker glyph drawn from primitives — avoids emoji-font dependency."""
    body = [
        (cx - r * 0.62, cy - r * 0.26), (cx - r * 0.22, cy - r * 0.26),
        (cx + r * 0.18, cy - r * 0.68), (cx + r * 0.18, cy + r * 0.68),
        (cx - r * 0.22, cy + r * 0.26), (cx - r * 0.62, cy + r * 0.26),
    ]
    d.polygon([(x * S, y * S) for x, y in body], fill=color)
    for rr in (0.42, 0.72):
        bb = [(cx + r * 0.10 - r * rr) * S, (cy - r * rr) * S,
              (cx + r * 0.10 + r * rr) * S, (cy + r * rr) * S]
        d.arc(bb, start=-52, end=52, fill=color, width=max(1, int(r * 0.16 * S)))


def browser_frame(img, d, x0, y0, x1, y1, url, tab_title, radius=12):
    """Chrome-style window chrome. Returns the y where page content starts."""
    img = shadow(img, (x0, y0, x1, y1), radius, blur=18, offset=(0, 8), alpha=110)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], radius=radius * S, fill=CHROME_BAR)

    # traffic lights
    for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        cxx = x0 + 20 + i * 18
        d.ellipse([(cxx - 6) * S, (y0 + 15) * S, (cxx + 6) * S, (y0 + 27) * S], fill=c)

    # active tab
    tx0, tx1, ty0, ty1 = x0 + 80, x0 + 320, y0 + 8, y0 + 42
    d.rounded_rectangle([tx0 * S, ty0 * S, tx1 * S, ty1 * S], radius=9 * S, fill=CHROME_TAB)
    d.rectangle([tx0 * S, (ty1 - 9) * S, tx1 * S, ty1 * S], fill=CHROME_TAB)
    speaker(d, tx0 + 20, (ty0 + ty1) / 2, 8, PURPLE)
    d.text((int((tx0 + 36) * S), int((ty0 + ty1) / 2 * S)), tab_title,
           font=font(11), fill=INK, anchor="lm")

    # url bar
    ux0, ux1, uy0, uy1 = x0 + 16, x1 - 16, y0 + 50, y0 + 78
    d.rounded_rectangle([ux0 * S, uy0 * S, ux1 * S, uy1 * S], radius=14 * S, fill=CHROME_URL)
    d.text((int((ux0 + 18) * S), int((uy0 + uy1) / 2 * S)), url,
           font=font(11.5), fill=GREY_TEXT, anchor="lm")
    # extension icon parked in the toolbar
    speaker(d, ux1 - 22, (uy0 + uy1) / 2, 8, PURPLE)
    return img, y0 + 86


def caption(d, w, y, main):
    d.text((int(w / 2 * S), int(y * S)), main, font=font(23, bold=True),
           fill=TEXT, anchor="mm")


def article(d, x, y, width, selection_line=None):
    """Wikipedia-style article. Returns bbox of the highlighted phrase."""
    d.text((x * S, y * S), "Text-to-speech", font=font(27, bold=True), fill=INK)
    d.text((x * S, (y + 38) * S), "From Wikipedia, the free encyclopedia",
           font=font(11), fill=GREY_TEXT)
    d.line([x * S, (y + 58) * S, (x + width) * S, (y + 58) * S], fill=(228, 230, 232), width=S)

    lines = [
        "Speech synthesis is the artificial production of human speech. A",
        "computer system used for this purpose is called a speech synthesizer,",
        "and can be implemented in software or hardware products. A",
        "text-to-speech system converts normal language text into speech.",
        "",
        "Synthesized speech can be created by concatenating pieces of recorded",
        "speech that are stored in a database. Systems differ in the size of the",
        "stored speech units; a system that stores phones or diphones provides",
        "the largest output range, but may lack clarity.",
        "",
        "The quality of a speech synthesizer is judged by its similarity to the",
        "human voice and by its ability to be understood clearly. An intelligible",
        "program allows people with visual impairments or reading disabilities to",
        "listen to written works on a home computer.",
        "",
        "Many operating systems have included speech synthesizers since the early",
        "1990s. A text-to-speech system is composed of two parts: a front-end,",
        "which converts raw text into its written-out word equivalent, and a",
        "back-end, which converts the symbolic representation into sound.",
    ]
    ly = y + 76
    hi = None
    for i, ln in enumerate(lines):
        if not ln:
            ly += 12
            continue
        if selection_line is not None and i in selection_line:
            tw = text_w(d, ln, font(13.5))
            pad = 2
            d.rectangle([(x - pad) * S, (ly - 3) * S, (x + tw + pad) * S, (ly + 18) * S],
                        fill=PURPLE)
            d.text((x * S, ly * S), ln, font=font(13.5), fill=WHITE)
            if hi is None:
                hi = [x, ly, x + tw, ly + 18]
            else:
                hi[2] = max(hi[2], x + tw)
                hi[3] = ly + 18
        else:
            d.text((x * S, ly * S), ln, font=font(13.5), fill=(60, 64, 67))
        ly += 22
    return hi


def infobox(d, x, y, w, h):
    d.rounded_rectangle([x * S, y * S, (x + w) * S, (y + h) * S],
                        radius=6 * S, fill=(248, 249, 250), outline=(218, 220, 224), width=S)
    d.text(((x + w / 2) * S, (y + 16) * S), "Speech synthesis",
           font=font(11.5, bold=True), fill=INK, anchor="mm")
    d.rounded_rectangle([(x + 14) * S, (y + 32) * S, (x + w - 14) * S, (y + 118) * S],
                        radius=4 * S, fill=(230, 232, 236))
    speaker(d, x + w / 2, y + 75, 22, (170, 175, 185))
    for i, (k, v) in enumerate([("Type", "Synthesis"), ("Field", "Linguistics"),
                                ("Used in", "Assistive tech")]):
        yy = y + 132 + i * 20
        d.text(((x + 14) * S, yy * S), k, font=font(10, bold=True), fill=GREY_TEXT)
        d.text(((x + 80) * S, yy * S), v, font=font(10), fill=(60, 64, 67))


def popup_icon(img, cx, cy):
    """The 36px floating circle that appears on selection."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.ellipse([(cx - 20) * S, (cy - 18) * S, (cx + 20) * S, (cy + 22) * S],
               fill=PURPLE + (120,))
    layer = layer.filter(ImageFilter.GaussianBlur(7 * S))
    img = Image.alpha_composite(img, layer)
    d = ImageDraw.Draw(img)
    d.ellipse([(cx - 18) * S, (cy - 18) * S, (cx + 18) * S, (cy + 18) * S],
              fill=BG_DARK, outline=PURPLE, width=2 * S)
    speaker(d, cx - 1, cy, 9, TEXT)
    return img


def pill(img, cx, cy):
    """Floating pill player — control order matches content-pill.js."""
    w, h, r = 430, 48, 24
    x0, y0, x1, y1 = cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2
    img = shadow(img, (x0, y0, x1, y1), r, blur=20, offset=(0, 8), alpha=120)

    # Contents render onto their own layer so the progress bar can be clipped to
    # the rounded shape, matching the real `overflow: hidden` on #sonorus-pill.
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], radius=r * S, fill=BG_DARK)

    cx_ = x0 + 16
    # drag handle ⠿
    for col in range(2):
        for row in range(3):
            px, py = cx_ + col * 4, cy - 6 + row * 6
            d.ellipse([(px - 1.4) * S, (py - 1.4) * S, (px + 1.4) * S, (py + 1.4) * S],
                      fill=(150, 140, 180))
    cx_ += 18
    # speaker
    speaker(d, cx_ + 8, cy, 10, TEXT)
    cx_ += 26

    def ctrl_btn(cxb, kind):
        d.ellipse([(cxb - 15) * S, (cy - 15) * S, (cxb + 15) * S, (cy + 15) * S],
                  fill=(52, 32, 84), outline=(120, 100, 165), width=S)
        if kind == "pause":
            for off in (-3.5, 2.0):
                d.rectangle([(cxb + off) * S, (cy - 6) * S, (cxb + off + 1.8) * S, (cy + 6) * S],
                            fill=TEXT)
        else:
            d.rectangle([(cxb - 5) * S, (cy - 5) * S, (cxb + 5) * S, (cy + 5) * S], fill=TEXT)

    ctrl_btn(cx_ + 15, "pause"); cx_ += 36
    ctrl_btn(cx_ + 15, "stop"); cx_ += 40

    # speed label + slider
    d.text(((cx_ + 14) * S, cy * S), "1x", font=font(11), fill=MUTED, anchor="mm")
    cx_ += 32
    sw = 70
    d.rounded_rectangle([cx_ * S, (cy - 2) * S, (cx_ + sw) * S, (cy + 2) * S],
                        radius=2 * S, fill=(70, 55, 100))
    d.rounded_rectangle([cx_ * S, (cy - 2) * S, (cx_ + sw * 0.33) * S, (cy + 2) * S],
                        radius=2 * S, fill=LAVENDER)
    kx = cx_ + sw * 0.33
    d.ellipse([(kx - 6) * S, (cy - 6) * S, (kx + 6) * S, (cy + 6) * S], fill=LAVENDER)
    cx_ += sw + 12

    # voice dropdown
    vw = 130
    d.rounded_rectangle([cx_ * S, (cy - 11) * S, (cx_ + vw) * S, (cy + 11) * S],
                        radius=8 * S, fill=(45, 30, 70), outline=(120, 100, 165), width=S)
    d.text(((cx_ + 9) * S, cy * S), "Google US English", font=font(9.5), fill=TEXT, anchor="lm")
    ax = cx_ + vw - 12
    d.polygon([((ax - 3.5) * S, (cy - 1.5) * S), ((ax + 3.5) * S, (cy - 1.5) * S),
               (ax * S, (cy + 2.5) * S)], fill=MUTED)
    cx_ += vw + 14

    # close ✕ — drawn as strokes; Arial has no U+2715 and renders a tofu box
    xr = 5
    for dx in (1, -1):
        d.line([(cx_ + 4 - xr * dx) * S, (cy - xr) * S, (cx_ + 4 + xr * dx) * S, (cy + xr) * S],
               fill=(150, 140, 180), width=max(1, int(1.6 * S)))

    # progress bar hugging the bottom edge (clipped by the mask below)
    d.rectangle([x0 * S, (y1 - 3.5) * S, (x0 + w * 0.42) * S, y1 * S], fill=PURPLE)

    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S],
                                           radius=r * S, fill=255)
    layer.putalpha(ImageChops.multiply(layer.split()[3], mask))
    img = Image.alpha_composite(img, layer)

    # border drawn last so clipping does not thin it out
    ImageDraw.Draw(img).rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], radius=r * S,
                                          outline=(167, 139, 250), width=S)
    return img


# ── Screenshot 1 ────────────────────────────────────────────────────────────
def screenshot_1():
    W, H = 1280, 800
    img = gradient_bg(W, H, (40, 18, 68), (18, 7, 34))
    d = ImageDraw.Draw(img)

    img, cy0 = browser_frame(img, d, 60, 36, 1220, 648,
                             "en.wikipedia.org/wiki/Text-to-speech", "Text-to-speech — Wikipedia")
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([60 * S, cy0 * S, 1220 * S, 648 * S], radius=12 * S, fill=WHITE)
    d.rectangle([60 * S, cy0 * S, 1220 * S, (cy0 + 20) * S], fill=WHITE)

    hi = article(d, 108, cy0 + 26, 560, selection_line={5, 6, 7})
    infobox(d, 900, cy0 + 30, 260, 200)

    img = popup_icon(img, hi[2] + 26, hi[3] - 6)
    d = ImageDraw.Draw(img)
    caption(d, W, 726, "Select any text to listen instantly")
    return img


# ── Screenshot 2 ────────────────────────────────────────────────────────────
def screenshot_2():
    W, H = 1280, 800
    img = gradient_bg(W, H, (40, 18, 68), (18, 7, 34))
    d = ImageDraw.Draw(img)

    img, cy0 = browser_frame(img, d, 60, 36, 1220, 648,
                             "en.wikipedia.org/wiki/Text-to-speech", "Text-to-speech — Wikipedia")
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([60 * S, cy0 * S, 1220 * S, 648 * S], radius=12 * S, fill=WHITE)
    d.rectangle([60 * S, cy0 * S, 1220 * S, (cy0 + 20) * S], fill=WHITE)

    article(d, 108, cy0 + 26, 560, selection_line={5, 6, 7})
    infobox(d, 900, cy0 + 30, 260, 200)

    img = pill(img, 640, 596)
    d = ImageDraw.Draw(img)
    caption(d, W, 726, "Floating pill player — pause, stop, change speed & voice")
    return img


# ── Screenshot 3 ────────────────────────────────────────────────────────────
def screenshot_3():
    W, H = 1280, 800
    img = gradient_bg(W, H, (40, 18, 68), (18, 7, 34))
    d = ImageDraw.Draw(img)

    img, cy0 = browser_frame(img, d, 60, 36, 1220, 648,
                             "chrome-extension://sonorus/settings/settings.html",
                             "Sonorus — Settings")
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([60 * S, cy0 * S, 1220 * S, 648 * S], radius=12 * S, fill=SET_BG)
    d.rectangle([60 * S, cy0 * S, 1220 * S, (cy0 + 20) * S], fill=SET_BG)

    L, R = 132, 1148          # content gutters
    BOTTOM = 636              # sections must stay above this
    GAP = 6

    # ── page header ──
    hy = cy0 + 24
    speaker(d, L + 10, hy + 10, 12, GOLD)
    d.text(((L + 30) * S, (hy + 1) * S), "Sonorus", font=font(20, bold=True), fill=PALE)
    d.text(((L + 118) * S, (hy + 10) * S), "Select. Listen. Float.",
           font=font(11.5), fill=MUTED, anchor="lm")
    d.text((R * S, (hy + 10) * S), "v3.0.0", font=font(10.5), fill=(130, 115, 165), anchor="rm")
    d.line([L * S, (hy + 30) * S, R * S, (hy + 30) * S], fill=(60, 45, 95), width=S)

    def section(sy, title, h):
        """Draws the card; returns (content_origin_y, next_cursor_y)."""
        assert sy + h <= BOTTOM, f"{title} overflows the window ({sy + h} > {BOTTOM})"
        d.rounded_rectangle([L * S, sy * S, R * S, (sy + h) * S], radius=10 * S,
                            fill=SET_SECTION, outline=(60, 45, 95), width=S)
        d.text(((L + 22) * S, (sy + 16) * S), title.upper(), font=font(10, bold=True),
               fill=LAVENDER, anchor="lm")
        return sy + 32, sy + h + GAP

    def row(ry, label):
        d.text(((L + 22) * S, ry * S), label, font=font(12), fill=TEXT, anchor="lm")

    def toggle(tx, ty, on=True):
        d.rounded_rectangle([tx * S, (ty - 9) * S, (tx + 36) * S, (ty + 9) * S],
                            radius=9 * S, fill=PURPLE if on else (70, 60, 95))
        kx = tx + 27 if on else tx + 9
        d.ellipse([(kx - 7) * S, (ty - 7) * S, (kx + 7) * S, (ty + 7) * S], fill=WHITE)

    def field(fx, fy, fw, txt, arrow=False):
        d.rounded_rectangle([fx * S, (fy - 12) * S, (fx + fw) * S, (fy + 12) * S],
                            radius=7 * S, fill=(38, 24, 62), outline=(80, 65, 120), width=S)
        d.text(((fx + 11) * S, fy * S), txt, font=font(10.5), fill=TEXT, anchor="lm")
        if arrow:
            ax = fx + fw - 13
            d.polygon([((ax - 4) * S, (fy - 2) * S), ((ax + 4) * S, (fy - 2) * S),
                       (ax * S, (fy + 3) * S)], fill=MUTED)

    def slider(sx, sy_, sw, frac):
        d.rounded_rectangle([sx * S, (sy_ - 2) * S, (sx + sw) * S, (sy_ + 2) * S],
                            radius=2 * S, fill=(70, 55, 100))
        d.rounded_rectangle([sx * S, (sy_ - 2) * S, (sx + sw * frac) * S, (sy_ + 2) * S],
                            radius=2 * S, fill=PURPLE)
        kx = sx + sw * frac
        d.ellipse([(kx - 7) * S, (sy_ - 7) * S, (kx + 7) * S, (sy_ + 7) * S], fill=LAVENDER)

    def cross(cxx, cyy, rr, col, wd):
        for dx in (1, -1):
            d.line([(cxx - rr * dx) * S, (cyy - rr) * S, (cxx + rr * dx) * S, (cyy + rr) * S],
                   fill=col, width=max(1, int(wd * S)))

    cur = hy + 38

    # ── General ──
    c, cur = section(cur, "General", 100)
    row(c + 4, "Enable Sonorus");                   toggle(R - 56, c + 4, True)
    row(c + 30, "Show floating icon on selection"); toggle(R - 56, c + 30, True)
    row(c + 56, "Minimum characters to trigger");   field(R - 100, c + 56, 100, "20")

    # ── Blocked Sites ──
    c, cur = section(cur, "Blocked Sites", 84)
    field(L + 22, c + 4, 300, "mail.google.com")
    d.rounded_rectangle([(L + 334) * S, (c - 8) * S, (L + 398) * S, (c + 16) * S],
                        radius=7 * S, fill=PURPLE)
    d.text(((L + 366) * S, (c + 4) * S), "Add", font=font(10.5, bold=True), fill=WHITE, anchor="mm")
    for i, s in enumerate(["docs.google.com", "figma.com", "x.com"]):
        cxs = L + 22 + i * 148
        d.rounded_rectangle([cxs * S, (c + 28) * S, (cxs + 136) * S, (c + 48) * S],
                            radius=10 * S, fill=(48, 30, 78), outline=(85, 65, 125), width=S)
        d.text(((cxs + 14) * S, (c + 38) * S), s, font=font(9.5), fill=MUTED, anchor="lm")
        cross(cxs + 120, c + 38, 3.5, (150, 135, 185), 1.3)

    # ── Voice ──
    c, cur = section(cur, "Voice", 84)
    row(c + 4, "Voice");  field(R - 232, c + 4, 210, "Google US English", arrow=True)
    d.rounded_rectangle([(L + 22) * S, (c + 28) * S, (L + 138) * S, (c + 52) * S],
                        radius=12 * S, fill=(52, 32, 84), outline=LAVENDER, width=S)
    speaker(d, L + 44, c + 40, 8, GOLD)
    d.text(((L + 60) * S, (c + 40) * S), "Demo voice", font=font(10.5, bold=True),
           fill=PALE, anchor="lm")
    d.text(((L + 168) * S, (c + 40) * S), "Pitch", font=font(12), fill=TEXT, anchor="lm")
    slider(L + 218, c + 40, 150, 0.5)
    d.text(((L + 384) * S, (c + 40) * S), "1.0", font=font(10.5), fill=MUTED, anchor="lm")

    # ── Playback ──
    c, cur = section(cur, "Playback", 84)
    row(c + 4, "Default speed")
    slider(R - 320, c + 4, 190, 0.33)
    d.text(((R - 100) * S, (c + 4) * S), "1.0x", font=font(10.5), fill=MUTED, anchor="lm")
    d.text(((L + 22) * S, (c + 40) * S), "Quick:", font=font(10), fill=(140, 128, 175), anchor="lm")
    for i, s in enumerate(["0.75x", "1x", "1.25x", "1.5x", "2x"]):
        bx = L + 66 + i * 58
        on = s == "1x"
        d.rounded_rectangle([bx * S, (c + 30) * S, (bx + 50) * S, (c + 50) * S],
                            radius=10 * S, fill=PURPLE if on else (44, 28, 72),
                            outline=LAVENDER if on else (80, 65, 120), width=S)
        d.text(((bx + 25) * S, (c + 40) * S), s, font=font(9.5, bold=True),
               fill=WHITE if on else MUTED, anchor="mm")

    # ── Appearance ──
    c, cur = section(cur, "Appearance", 72)
    row(c + 6, "Pill default position");  field(R - 242, c + 6, 220, "Bottom center", arrow=True)
    row(c + 32, "Pill theme");            field(R - 242, c + 32, 220, "Auto", arrow=True)

    caption(d, W, 726, "Full settings — block sites, pick voice, set speed")
    return img



# ── Promo tile ──────────────────────────────────────────────────────────────
def promo_tile():
    W, H = 440, 280
    img = canvas(W, H, BG_DARK)
    d = ImageDraw.Draw(img)

    # radial-ish glow behind the mark
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([90 * S, 30 * S, 350 * S, 200 * S], fill=PURPLE + (70,))
    glow = glow.filter(ImageFilter.GaussianBlur(38 * S))
    img = Image.alpha_composite(img, glow)

    # subtle concentric sound waves
    wave = Image.new("RGBA", img.size, (0, 0, 0, 0))
    wd = ImageDraw.Draw(wave)
    for i, rr in enumerate((78, 108, 138, 168, 198)):
        a = 58 - i * 10
        wd.arc([(220 - rr) * S, (96 - rr) * S, (220 + rr) * S, (96 + rr) * S],
               start=-62, end=62, fill=LAVENDER + (a,), width=max(1, int(2 * S)))
        wd.arc([(220 - rr) * S, (96 - rr) * S, (220 + rr) * S, (96 + rr) * S],
               start=118, end=242, fill=LAVENDER + (a,), width=max(1, int(2 * S)))
    img = Image.alpha_composite(img, wave)
    d = ImageDraw.Draw(img)

    speaker(d, 216, 96, 40, PALE)
    # gold wand accent
    d.line([(246) * S, (72) * S, (274) * S, (46) * S], fill=GOLD, width=int(3 * S))
    for sx, sy_, sr in ((278, 42, 4.5), (266, 60, 2.6), (286, 58, 2.0)):
        d.ellipse([(sx - sr) * S, (sy_ - sr) * S, (sx + sr) * S, (sy_ + sr) * S], fill=GOLD)

    d.text((220 * S, 190 * S), "Sonorus", font=font(46, bold=True), fill=WHITE, anchor="mm")
    d.text((220 * S, 228 * S), "Select. Listen. Float.", font=font(16), fill=LAVENDER, anchor="mm")
    d.line([160 * S, 250 * S, 280 * S, 250 * S], fill=PURPLE, width=int(2 * S))
    return img


def save(img, name, size):
    os.makedirs(ASSETS, exist_ok=True)
    out = img.convert("RGB").resize(size, Image.LANCZOS)
    path = os.path.join(ASSETS, name)
    out.save(path, "PNG", optimize=True)
    print(f"  {name}  {out.size[0]}x{out.size[1]}  mode={out.mode}")


if __name__ == "__main__":
    print("Generating Chrome Web Store assets into assets/ ...")
    save(screenshot_1(), "screenshot-1.png", (1280, 800))
    save(screenshot_2(), "screenshot-2.png", (1280, 800))
    save(screenshot_3(), "screenshot-3.png", (1280, 800))
    save(promo_tile(), "promo-tile.png", (440, 280))
    print("Done.")
