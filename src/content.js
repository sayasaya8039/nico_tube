/**
 * NicoTube - YouTubeでニコニコ動画のリンクを表示
 */

console.log('[NicoTube] 拡張機能が読み込まれました');

// 状態管理
let currentVideoId = null;
let nicotubeContainer = null;

/**
 * ニコニコ動画のスナップショットAPIで検索（バックグラウンド経由）
 * @param {string} query - 検索クエリ
 * @returns {Promise<Object[]>} 検索結果
 */
async function searchNicoVideo(query) {
  console.log('[NicoTube] API検索:', query);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'searchNicoVideo',
      query: query
    });

    if (!response.success) {
      throw new Error(response.error || 'Unknown error');
    }

    console.log('[NicoTube] 検索結果:', response.data?.length || 0, '件');
    return response.data || [];
  } catch (error) {
    console.error('[NicoTube] 検索エラー:', error);
    return [];
  }
}

/**
 * YouTubeの動画タイトルを取得
 * @returns {string|null}
 */
function getVideoTitle() {
  // 2024年以降のYouTubeレイアウト対応
  const selectors = [
    // 新しいレイアウト
    'ytd-watch-metadata h1.ytd-watch-metadata yt-formatted-string',
    'ytd-watch-metadata #title yt-formatted-string',
    '#above-the-fold #title yt-formatted-string',
    // 古いレイアウト
    'h1.ytd-video-primary-info-renderer yt-formatted-string',
    '#info-contents h1 yt-formatted-string',
    // フォールバック
    'h1 yt-formatted-string.ytd-watch-metadata',
    '#title h1 yt-formatted-string'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      console.log('[NicoTube] タイトル取得成功 (selector:', selector, ')');
      return element.textContent.trim();
    }
  }

  // meta tagから取得
  const metaTitle = document.querySelector('meta[name="title"]');
  if (metaTitle && metaTitle.getAttribute('content')) {
    console.log('[NicoTube] タイトル取得成功 (meta tag)');
    return metaTitle.getAttribute('content');
  }

  // og:titleから取得
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle && ogTitle.getAttribute('content')) {
    console.log('[NicoTube] タイトル取得成功 (og:title)');
    return ogTitle.getAttribute('content');
  }

  // document.titleから取得（最終手段）
  if (document.title && document.title.includes(' - YouTube')) {
    const title = document.title.replace(' - YouTube', '').trim();
    if (title) {
      console.log('[NicoTube] タイトル取得成功 (document.title)');
      return title;
    }
  }

  console.log('[NicoTube] タイトルが取得できませんでした');
  return null;
}

/**
 * URLから動画IDを抽出
 * @returns {string|null}
 */
function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}

/**
 * NicoTubeのUIコンテナを作成
 */
function createContainer() {
  if (nicotubeContainer) {
    nicotubeContainer.remove();
  }

  nicotubeContainer = document.createElement('div');
  nicotubeContainer.id = 'nicotube-container';
  nicotubeContainer.innerHTML = `
    <div class="nicotube-header">
      <span class="nicotube-logo">N</span>
      <span class="nicotube-title">ニコニコ動画で見る</span>
      <button class="nicotube-close" aria-label="閉じる">&times;</button>
    </div>
    <div class="nicotube-content">
      <div class="nicotube-loading">検索中...</div>
    </div>
  `;

  // 閉じるボタンのイベント
  nicotubeContainer.querySelector('.nicotube-close').addEventListener('click', () => {
    nicotubeContainer.classList.add('nicotube-hidden');
  });

  document.body.appendChild(nicotubeContainer);
  return nicotubeContainer;
}

/**
 * 検索結果を表示
 * @param {Object[]} results - 検索結果
 */
function displayResults(results) {
  // コンテナが存在しない場合は何もしない（ナビゲーション中に削除された場合）
  if (!nicotubeContainer) {
    console.log('[NicoTube] コンテナが存在しないため表示をスキップ');
    return;
  }

  const content = nicotubeContainer.querySelector('.nicotube-content');

  if (results.length === 0) {
    content.innerHTML = '<div class="nicotube-empty">ニコニコ動画に該当する動画が見つかりませんでした</div>';
    return;
  }

  const html = results.map(video => `
    <a href="https://www.nicovideo.jp/watch/${video.contentId}"
       target="_blank"
       rel="noopener noreferrer"
       class="nicotube-item">
      <img src="${video.thumbnailUrl}" alt="" class="nicotube-thumb" loading="lazy">
      <div class="nicotube-info">
        <div class="nicotube-video-title">${escapeHtml(video.title)}</div>
        <div class="nicotube-views">${formatNumber(video.viewCounter)} 再生</div>
      </div>
    </a>
  `).join('');

  content.innerHTML = html;
}

/**
 * HTMLエスケープ
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 数値をフォーマット
 * @param {number} num
 * @returns {string}
 */
function formatNumber(num) {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return num.toLocaleString();
}

/**
 * 検索クエリを最適化（余分な情報を除去）
 * @param {string} title
 * @returns {string[]} 検索クエリの配列（優先度順）
 */
function optimizeQuery(title) {
  // 基本的なクリーンアップ
  let cleaned = title
    // 【】と[]を削除
    .replace(/【[^】]*】/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    // ボーカルソフト名を削除
    .replace(/\b(Synthesizer\s*V|SynthV|VOCALOID\d?|VOICALOID|UTAU|CeVIO|NEUTRINO|ACE\s*Studio|Piapro\s*Studio)\b/gi, ' ')
    // カバー・歌い手情報を削除
    .replace(/\s*(covered?\s*by|歌[：:]|vocal[：:]|singer[：:]|sung\s*by|feat\.?|ft\.?)\s*.+?(\/|$)/gi, '/')
    .replace(/\s*(covered?\s*by|歌[：:]|vocal[：:]|singer[：:]|sung\s*by)\s*.+$/gi, '')
    // 長い括弧内容を削除
    .replace(/\([^)]{10,}\)/g, '')
    .replace(/（[^）]{10,}）/g, '')
    // 動画種類タグを削除
    .replace(/(\s*[-|｜/／]\s*)?(公式|Official|MV|PV|Music Video|Full|HD|4K|Lyrics?|歌詞|字幕|sub|subtitle|COVER|カバー|歌ってみた|演奏してみた|弾いてみた|叩いてみた|AI)/gi, '')
    // 全角英数字を半角に
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    // 連続する大文字英単語（ローマ字表記）を削除
    .replace(/\s+[A-Z]{2,}(\s+[A-Z]{2,})+\s*/g, ' ')
    // 末尾の大文字英単語の連続を削除
    .replace(/\s+[A-Z]{2,}(\s+[A-Z]{2,})*$/g, '')
    // 空白の正規化
    .replace(/\s+/g, ' ')
    .trim();

  const queries = [];

  // パターン1: 「曲名 / 作者」形式から曲名と作者を抽出
  const slashMatch = cleaned.match(/^(.+?)\s*[\/／]\s*(.+?)$/);
  if (slashMatch) {
    const songName = slashMatch[1].trim();
    const artist = slashMatch[2].trim().split(/\s/)[0]; // 作者名の最初の部分だけ

    // 曲名のみ（最優先）
    if (songName.length >= 2) {
      queries.push(songName);
    }
    // 曲名 + 作者
    if (songName.length >= 2 && artist.length >= 2) {
      queries.push(`${songName} ${artist}`);
    }
  }

  // パターン2: 日本語部分のみを抽出（曲名として最も有効）
  const japaneseMatch = cleaned.match(/^([ぁ-んァ-ヶー一-龠々\w\s-]+)/);
  if (japaneseMatch) {
    const japanesePart = japaneseMatch[1].trim();
    if (japanesePart.length >= 2 && !queries.includes(japanesePart)) {
      queries.push(japanesePart);
    }
  }

  // パターン3: クリーンアップ済みのタイトル全体
  if (cleaned.length >= 3 && !queries.includes(cleaned)) {
    queries.push(cleaned);
  }

  // パターン4: 元のタイトルから【】[]のみ削除したもの
  const minimal = title
    .replace(/【[^】]*】/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (minimal.length >= 3 && !queries.includes(minimal)) {
    queries.push(minimal);
  }

  // クエリがない場合は元のタイトル
  if (queries.length === 0) {
    queries.push(title);
  }

  console.log('[NicoTube] 生成されたクエリ:', queries);
  return queries;
}

/**
 * タイトルが読み込まれるまで待機
 * @param {number} maxWait - 最大待機時間（ミリ秒）
 * @returns {Promise<string|null>}
 */
async function waitForTitle(maxWait = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const title = getVideoTitle();
    if (title) {
      return title;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return null;
}

/**
 * メイン処理
 */
async function main() {
  console.log('[NicoTube] main() 実行, URL:', window.location.href);

  // YouTube動画ページかチェック
  if (!window.location.pathname.startsWith('/watch')) {
    console.log('[NicoTube] 動画ページではありません');
    if (nicotubeContainer) {
      nicotubeContainer.classList.add('nicotube-hidden');
    }
    return;
  }

  const videoId = getVideoId();
  console.log('[NicoTube] 動画ID:', videoId);

  // 同じ動画の場合はスキップ
  if (videoId === currentVideoId && nicotubeContainer) {
    nicotubeContainer.classList.remove('nicotube-hidden');
    return;
  }

  currentVideoId = videoId;

  // タイトル取得を待機
  const title = await waitForTitle();
  if (!title) {
    console.log('[NicoTube] タイトルが取得できませんでした');
    return;
  }

  console.log('[NicoTube] 検索開始:', title);

  // UIを表示
  createContainer();

  // 検索実行（複数のクエリを順番に試す）
  const queries = optimizeQuery(title);
  let results = [];

  for (const query of queries) {
    console.log('[NicoTube] クエリ試行:', query);
    results = await searchNicoVideo(query);
    if (results.length > 0) {
      console.log('[NicoTube] ヒット:', query);
      break;
    }
  }

  // 結果を表示
  displayResults(results);
}

/**
 * ナビゲーション時にリセットして再検索
 */
function onNavigate() {
  console.log('[NicoTube] ナビゲーション検出 - リセット');
  // 前の動画IDをクリアして強制再検索
  currentVideoId = null;
  // 既存のコンテナを削除
  if (nicotubeContainer) {
    nicotubeContainer.remove();
    nicotubeContainer = null;
  }
  // 少し遅延してから実行（ページ読み込み待ち）
  setTimeout(main, 800);
}

// YouTube SPAのナビゲーションを監視（複数の方法を使用）

// 方法1: yt-navigate-finish イベント（YouTube公式のSPAイベント）
document.addEventListener('yt-navigate-finish', () => {
  console.log('[NicoTube] yt-navigate-finish イベント検出');
  onNavigate();
});

// 方法2: yt-navigate-start イベント（ナビゲーション開始時）
document.addEventListener('yt-navigate-start', () => {
  console.log('[NicoTube] yt-navigate-start イベント検出');
  // コンテナを即座に非表示
  if (nicotubeContainer) {
    nicotubeContainer.remove();
    nicotubeContainer = null;
  }
  currentVideoId = null;
});

// 方法3: URL変化の監視（MutationObserver）
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    console.log('[NicoTube] URL変化検出:', lastUrl, '->', location.href);
    lastUrl = location.href;
    onNavigate();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// 方法4: popstate イベント（ブラウザの戻る/進む）
window.addEventListener('popstate', () => {
  console.log('[NicoTube] popstate イベント検出');
  onNavigate();
});

// 方法5: ページ表示時（他サイトから戻ってきた時）
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    console.log('[NicoTube] ページが表示されました');
    // 動画ページでコンテナがない場合は再実行
    if (window.location.pathname.startsWith('/watch') && !nicotubeContainer) {
      console.log('[NicoTube] コンテナがないため再実行');
      currentVideoId = null;
      setTimeout(main, 500);
    }
  }
});

// 方法6: フォーカス時（タブ切り替え）
window.addEventListener('focus', () => {
  console.log('[NicoTube] ウィンドウにフォーカス');
  if (window.location.pathname.startsWith('/watch') && !nicotubeContainer) {
    console.log('[NicoTube] コンテナがないため再実行');
    currentVideoId = null;
    setTimeout(main, 500);
  }
});

// 方法7: pageshow イベント（BFCache から復元時）
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    console.log('[NicoTube] BFCacheから復元');
    currentVideoId = null;
    if (nicotubeContainer) {
      nicotubeContainer.remove();
      nicotubeContainer = null;
    }
    setTimeout(main, 500);
  }
});

// 初期実行（少し遅延させる）
setTimeout(main, 1000);
