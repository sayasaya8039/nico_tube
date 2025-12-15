"""
アイコン生成スクリプト
Pillowがない場合は pip install Pillow でインストール
"""

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Pillowをインストールしてください: pip install Pillow")
    exit(1)

import os

# アイコンサイズ
SIZES = [16, 48, 128]

# 色設定（パステル水色系）
BG_COLOR = (56, 189, 248)  # #38BDF8
TEXT_COLOR = (15, 23, 42)   # #0F172A

def create_icon(size):
    """指定サイズのアイコンを生成"""
    # 画像作成
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 角丸の背景
    radius = size // 4
    draw.rounded_rectangle(
        [(0, 0), (size - 1, size - 1)],
        radius=radius,
        fill=BG_COLOR
    )

    # "N" の文字を描画
    font_size = int(size * 0.6)
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        font = ImageFont.load_default()

    text = "N"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    x = (size - text_width) // 2
    y = (size - text_height) // 2 - bbox[1]

    draw.text((x, y), text, fill=TEXT_COLOR, font=font)

    return img

def main():
    # 出力ディレクトリ
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, '..', 'src', 'icons')
    os.makedirs(output_dir, exist_ok=True)

    # 各サイズのアイコンを生成
    for size in SIZES:
        icon = create_icon(size)
        output_path = os.path.join(output_dir, f'icon{size}.png')
        icon.save(output_path, 'PNG')
        print(f"生成完了: icon{size}.png")

    print("\nアイコン生成が完了しました")

if __name__ == '__main__':
    main()
