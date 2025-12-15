# NicoTube - ニコ動リンク表示

YouTubeで動画を視聴中に、同じ動画がニコニコ動画にもある場合、リンクを表示するChrome拡張機能です。

## 機能

- YouTubeの動画ページで自動的にニコニコ動画を検索
- 関連する動画のサムネイル、タイトル、再生数を表示
- クリックでニコニコ動画の該当ページに移動

## インストール

### 開発版（手動インストール）

1. このリポジトリをクローン
2. `python scripts/build.py` でビルド
3. Chromeで `chrome://extensions` を開く
4. 「デベロッパーモード」を有効化
5. 「パッケージ化されていない拡張機能を読み込む」をクリック
6. `nico_tube` フォルダを選択

### 配布版

`nico_tube_v1.0.0.zip` をダウンロードして解凍し、上記の手順5-6を実行してください。

## 使い方

1. YouTubeで動画を開く
2. 画面右下にニコニコ動画の検索結果が表示される
3. クリックでニコニコ動画の該当ページを開く
4. ×ボタンで非表示にできる

## 開発

### 必要なもの

- Python 3.8+
- Pillow（アイコン生成用）

### コマンド

```bash
# アイコン生成
python scripts/generate_icons.py

# ビルド
python scripts/build.py
```

### フォルダ構成

```
nico_tube/
├── src/                    # ソースコード
│   ├── manifest.json       # 拡張機能の設定
│   ├── content.js          # メインスクリプト
│   ├── styles.css          # スタイル
│   └── icons/              # アイコン画像
├── scripts/                # ビルドスクリプト
│   ├── build.py
│   └── generate_icons.py
├── nico_tube/              # ビルド出力
└── nico_tube_v1.0.0.zip    # 配布用ZIP
```

## 技術仕様

- Manifest V3
- ニコニコ動画スナップショットAPI（検索）
- YouTube SPAナビゲーション対応（MutationObserver）

## ライセンス

MIT License
