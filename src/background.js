/**
 * NicoTube - バックグラウンドスクリプト (Service Worker)
 * CORSを回避するためAPIリクエストをここで処理
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'searchNicoVideo') {
    searchNicoVideo(request.query)
      .then(results => sendResponse({ success: true, data: results }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 非同期レスポンスを示す
  }
});

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

  const response = await fetch(`${endpoint}?${params}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  const data = await response.json();
  return data.data || [];
}
