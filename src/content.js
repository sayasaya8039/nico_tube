/**
 * NicoTube - YouTubeでニコニコ動画のリンクを表示
 */

// 状態管理
let currentVideoId = null;
let nicotubeContainer = null;

/**
 * ニコニコ動画のスナップショットAPIで検索
 * @param {string} query - 検索クエリ
 * @returns {Promise<Object[]>} 検索結果
 */
async function searchNicoVideo(query) {
  const endpoint = 'https://snapshot.search.nicovideo.jp/api/v2/snapshot/video/contents/search';
  const params = new URLSearchParams({
    q: query,
    targets: 'title',
    fields: 'contentId,title,viewCounter,thumbnailUrl',
    _sort: '-viewCounter',
    _limit: '5'
  });

  try {
    const response = await fetch(`${endpoint}?${params}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data.data || [];
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
  // メインの動画タイトル要素
  const titleElement = document.querySelector(
    'h1.ytd-watch-metadata yt-formatted-string, ' +
    'h1.title.ytd-video-primary-info-renderer yt-formatted-string, ' +
    '#title h1 yt-formatted-string'
  );

  if (titleElement) {
    return titleElement.textContent.trim();
  }

  // フォールバック: meta tagから取得
  const metaTitle = document.querySelector('meta[name="title"]');
  if (metaTitle) {
    return metaTitle.getAttribute('content');
  }

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
  // よくある不要なパターンを除去
  let query = title
    // 【】内の情報を除去（チャンネル名など）
    .replace(/【[^】]*】/g, '')
    // []内の情報を除去
    .replace(/\[[^\]]*\]/g, '')
    // ()内の情報を一部除去（長いものだけ）
    .replace(/\([^)]{10,}\)/g, '')
    // 公式、Official等を除去
    .replace(/(\s*[-|｜]\s*)?(公式|Official|MV|PV|Music Video|Full|HD|4K|Lyrics?|歌詞|字幕|sub|subtitle)/gi, '')
    // 余分な空白を整理
    .replace(/\s+/g, ' ')
    .trim();

  // 短すぎる場合は元のタイトルを使用
  if (query.length < 3) {
    query = title;
  }

  return query;
}

/**
 * メイン処理
 */
async function main() {
  // YouTube動画ページかチェック
  if (!window.location.pathname.startsWith('/watch')) {
    if (nicotubeContainer) {
      nicotubeContainer.classList.add('nicotube-hidden');
    }
    return;
  }

  const videoId = getVideoId();

  // 同じ動画の場合はスキップ
  if (videoId === currentVideoId && nicotubeContainer) {
    nicotubeContainer.classList.remove('nicotube-hidden');
    return;
  }

  currentVideoId = videoId;

  // タイトル取得を少し待つ（SPAのため）
  await new Promise(resolve => setTimeout(resolve, 1000));

  const title = getVideoTitle();
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

// YouTube SPAのナビゲーションを監視
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    main();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// 初期実行
main();
