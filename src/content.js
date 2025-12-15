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
 * @returns {string}
 */
function optimizeQuery(title) {
  let query = title
    .replace(/【[^】]*】/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]{10,}\)/g, '')
    .replace(/(\s*[-|｜]\s*)?(公式|Official|MV|PV|Music Video|Full|HD|4K|Lyrics?|歌詞|字幕|sub|subtitle)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (query.length < 3) {
    query = title;
  }

  return query;
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

  // 検索実行
  const query = optimizeQuery(title);
  const results = await searchNicoVideo(query);

  // 結果を表示
  displayResults(results);
}

// YouTube SPAのナビゲーションを監視（複数の方法を使用）

// 方法1: yt-navigate-finish イベント（YouTube公式のSPAイベント）
document.addEventListener('yt-navigate-finish', () => {
  console.log('[NicoTube] yt-navigate-finish イベント検出');
  main();
});

// 方法2: URL変化の監視（MutationObserver）
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    console.log('[NicoTube] URL変化検出:', lastUrl, '->', location.href);
    lastUrl = location.href;
    setTimeout(main, 500);
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// 方法3: popstate イベント（ブラウザの戻る/進む）
window.addEventListener('popstate', () => {
  console.log('[NicoTube] popstate イベント検出');
  main();
});

// 初期実行（少し遅延させる）
setTimeout(main, 1000);
