#!/usr/bin/env python3
"""
Genie branding generator — gradient "G" + 🧞 genie mark.

Draws the brand tile used across the app (see components/icons.js GradientIcon /
GRADIENTS): a maroon->orange diagonal gradient rounded tile with a white
Montserrat-900 "G" and the genie emoji overlapping its top — mirroring the web
favicon (GENIE_WEB/assets/images/favicon.svg).

Outputs (overwritten in place):
  assets/icon.png            1024x1024  app icon (rounded tile)
  assets/adaptive-icon.png   1024x1024  Android adaptive foreground (full-bleed bg,
                                        mark inside the 66% safe zone)
  assets/favicon.png         192x192    web favicon (rounded tile)
  assets/splash.png          1242x2436  launch screen (full-bleed gradient + mark)
  branding-preview.png       preview sheet of all four (project root)

Usage:
  python3 scripts/generate-icons.py
"""
import os

from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")

MONTSERRAT_900 = os.path.join(
    ROOT, "node_modules/@expo-google-fonts/montserrat/900Black/Montserrat_900Black.ttf"
)
EMOJI_FONT = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"
EMOJI_STRIKE = 109  # NotoColorEmoji's only renderable strike size in PIL

# Brand gradient (web maroon #9C2007 -> vivid orange), diagonal top-left -> bottom-right
GRAD_START = (156, 32, 7)     # #9C2007
GRAD_END = (249, 115, 22)     # #F97316


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient_bg(size):
    """Smooth diagonal gradient via a tiny loop + high-quality resize."""
    w, h = size
    small = Image.new("RGB", (256, 256))
    px = small.load()
    for y in range(256):
        for x in range(256):
            px[x, y] = lerp(GRAD_START, GRAD_END, (x + y) / 512.0)
    return small.resize((w, h), Image.LANCZOS)


def rounded_mask(size, radius):
    """White rounded-rectangle mask with soft (feathered) edges."""
    w, h = size
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
    return m.filter(ImageFilter.GaussianBlur(1.5))


def glass_highlight(size, strength=60):
    """Subtle top-left radial lighten for a glassy, futuristic feel."""
    w, h = size
    glow = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(glow)
    d.ellipse([-int(w * 0.25), -int(h * 0.35), int(w * 0.55), int(h * 0.45)], fill=strength)
    glow = glow.filter(ImageFilter.GaussianBlur(int(w * 0.09)))
    white = Image.new("RGB", (w, h), (255, 255, 255))
    return Image.composite(white, Image.new("RGB", (w, h), (0, 0, 0)), glow)


def render_g(text, font_path, px, color=(255, 255, 255, 255)):
    """Render text centered, cropped to its glyph box, on transparent RGBA."""
    f = ImageFont.truetype(font_path, px)
    pad = px
    img = Image.new("RGBA", (2 * pad + px, 2 * pad + px), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((img.width / 2, img.height / 2), text, font=f, fill=color, anchor="mm")
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    return img


def render_emoji(px):
    """Render the genie emoji at its native strike, cropped to the glyph."""
    f = ImageFont.truetype(EMOJI_FONT, EMOJI_STRIKE)
    img = Image.new("RGBA", (EMOJI_STRIKE + 12, EMOJI_STRIKE + 12), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((6, 6), "\U0001F9DE", font=f, embedded_color=True)
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    return img


def build_mark(size, g_frac, genie_offset=0.26):
    """
    White G + genie mark composited on transparent canvas of `size`.
    g_frac: G font size as a fraction of canvas width.
    genie_offset: genie center distance above canvas middle (fraction of width);
                  smaller values tuck the genie tighter against the G.
    """
    w = size[0]
    g_px = int(w * g_frac)

    g_img = render_g("G", MONTSERRAT_900, g_px, (255, 255, 255, 255))
    gx = int(w * 0.5 - g_img.width / 2)
    gy = int(w * 0.585 - g_img.height / 2)

    # Genie overlapping the top of the G (favicon layout: emoji floats on the G's top)
    genie = render_emoji(EMOJI_STRIKE)
    genie_h = int(g_px * 0.46)
    genie = genie.resize((int(genie_h * genie.width / genie.height), genie_h), Image.LANCZOS)
    gex = int(w * 0.5 - genie.width / 2)
    gey = int(w * 0.5 - w * genie_offset - genie.height / 2)

    mark = Image.new("RGBA", size, (0, 0, 0, 0))
    mark.alpha_composite(g_img, (gx, gy))
    mark.alpha_composite(genie, (gex, gey))
    return mark


def compose_tile(size, radius_frac, g_frac, genie_offset=0.26):
    """Gradient rounded tile + mark."""
    w = size[0]
    bg = gradient_bg(size).convert("RGBA")
    bg = Image.alpha_composite(bg, glass_highlight(size).convert("RGBA"))
    mark = build_mark(size, g_frac, genie_offset)
    out = Image.alpha_composite(bg, mark)
    if radius_frac:
        mask = rounded_mask(size, int(w * radius_frac))
        out.putalpha(mask)
    return out


def main():
    os.makedirs(ASSETS, exist_ok=True)

    # 1. App icon — rounded tile, mark fills most of the canvas
    icon = compose_tile((1024, 1024), radius_frac=0.22, g_frac=0.63)
    icon.save(os.path.join(ASSETS, "icon.png"))

    # 2. Android adaptive — full-bleed bg (system masks), mark inside 66% safe zone.
    #    Tighter genie offset so the whole mark stays inside the safe circle.
    adaptive = compose_tile((1024, 1024), radius_frac=0.0, g_frac=0.44, genie_offset=0.20)
    adaptive.save(os.path.join(ASSETS, "adaptive-icon.png"))

    # 3. Web favicon
    favicon = compose_tile((192, 192), radius_frac=0.24, g_frac=0.62)
    favicon.save(os.path.join(ASSETS, "favicon.png"))

    # 4. Splash — full-bleed gradient + centered mark + wordmark
    splash_w, splash_h = 1242, 2436
    splash = gradient_bg((splash_w, splash_h)).convert("RGBA")
    splash = Image.alpha_composite(splash, glass_highlight((splash_w, splash_h), 90).convert("RGBA"))
    mark = build_mark((splash_w, splash_w), g_frac=0.42, genie_offset=0.19)  # square canvas for mark layout
    b = mark.getbbox()
    paste_y = int(splash_h * 0.40 - (b[1] + b[3]) / 2)
    splash.alpha_composite(mark, (0, paste_y))
    # "GENIE" wordmark under the mark
    f = ImageFont.truetype(MONTSERRAT_900, int(splash_w * 0.10))
    l, t, rr, bb = f.getbbox("GENIE", anchor="mm")
    wm_w, wm_h = int(rr - l) + 60, int(bb - t) + 60
    wm = Image.new("RGBA", (wm_w, wm_h), (0, 0, 0, 0))
    d = ImageDraw.Draw(wm)
    d.text((wm_w / 2, wm_h / 2), "GENIE", font=f, fill=(255, 255, 255, 255), anchor="mm")
    splash.alpha_composite(wm, (int((splash_w - wm_w) / 2), int(splash_h * 0.60 - wm_h / 2)))
    splash.save(os.path.join(ASSETS, "splash.png"))

    # 5. Preview sheet for quick eyeballing
    sheet = Image.new("RGBA", (1024, 700), (15, 23, 42, 255))
    icon_sm = icon.resize((320, 320), Image.LANCZOS)
    adaptive_sm = adaptive.resize((320, 320), Image.LANCZOS)
    favicon_sm = favicon.resize((160, 160), Image.LANCZOS)
    splash_sm = splash.resize((124, 243), Image.LANCZOS)
    sheet.paste(icon_sm, (24, 24), icon_sm)
    sheet.paste(adaptive_sm, (372, 24), adaptive_sm)
    sheet.paste(favicon_sm, (720, 104), favicon_sm)
    sheet.paste(splash_sm, (900, 24), splash_sm)
    sheet.save(os.path.join(ROOT, "branding-preview.png"))

    print("Generated:")
    for f in ("icon.png", "adaptive-icon.png", "favicon.png", "splash.png"):
        print("  assets/%s" % f)
    print("  branding-preview.png")


if __name__ == "__main__":
    main()
