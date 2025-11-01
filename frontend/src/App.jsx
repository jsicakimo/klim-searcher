import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

// 輔助函式：將 Date 物件轉換為 'YYYY-MM-DD' 格式的字串
function formatDate(date) {
  const year = date.getFullYear();
  // getMonth() 回傳 0-11，所以要加 1
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 建立一個中文到英文的對照表，用於設定 CSS class
const sentimentClassMap = {
  正面: "positive",
  負面: "negative",
  中性: "neutral",
};

function App() {
  // 計算預設日期
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [stats, setStats] = useState(null);
  const [selectedNews, setSelectedNews] = useState(new Set());
  const [sourceFilter, setSourceFilter] = useState(new Set()); // 改為 Set 以支援多選
  const [sortOrder, setSortOrder] = useState("date-desc"); // 新增：排序狀態

  const handleSearch = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const params = Object.fromEntries(formData.entries());

    setLoading(true);
    setError(null);
    setSuccess(null);
    setResults([]);
    setStats(null);
    setSelectedNews(new Set());
    setSourceFilter(new Set()); // 重置篩選條件

    try {
      const response = await axios.get("/api/news", { params });
      if (response.data.success) {
        const newsData = response.data.data;
        setResults(newsData);
        setStats(response.data.stats);
        setSuccess(`✅ 成功獲取 ${response.data.count} 則新聞`);
        // 功能2：預設全選所有新聞
        // 修正：儲存完整的新聞物件，而不是索引
        setSelectedNews(new Set(newsData));
      } else {
        setError(response.data.error || "搜尋失敗");
      }
    } catch (err) {
      setError(`❌ 錯誤: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 新增：處理來源篩選的點擊事件
  const handleSourceFilterClick = (source) => {
    // 更新篩選 Set
    setSourceFilter((prevFilter) => {
      const newFilter = new Set(prevFilter); // 複製一個新的 Set
      if (newFilter.has(source)) {
        newFilter.delete(source); // 如果已存在，則移除 (取消選取)
      } else {
        newFilter.add(source); // 如果不存在，則加入 (選取)
      }
      return newFilter;
    });
  };

  const handleCheckboxChange = (item, isChecked) => {
    setSelectedNews((prev) => {
      const newSet = new Set(prev);
      if (isChecked) {
        newSet.add(item);
      } else {
        newSet.delete(item);
      }
      return newSet;
    });
  };

  const handleDownload = async () => {
    if (selectedNews.size === 0) {
      setError("請先勾選要下載的新聞項目");
      return;
    }

    // 修正：只下載當前可見（符合篩選條件）且被勾選的新聞
    const itemsToDownload = Array.from(selectedNews).filter(
      (item) => sourceFilter.size === 0 || sourceFilter.has(item.來源)
    );

    if (itemsToDownload.length === 0) {
      setError("在目前的篩選條件下，沒有可下載的已勾選項目。");
      return;
    }

    try {
      const response = await axios.post(
        "/api/download-selected",
        itemsToDownload, // 修正：傳送篩選後的列表
        {
          responseType: "blob", // 關鍵：期望後端回傳二進位資料
        }
      );

      // 建立一個暫時的 URL 來觸發瀏覽器下載
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const filename = `selected_news_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSuccess("✅ 已觸發下載");
    } catch (err) {
      setError(`❌ 下載失敗: ${err.message}`);
    }
  };

  // 新增：根據當前排序狀態對結果進行排序
  const sortedResults = [...results].sort((a, b) => {
    const dateA = new Date(a.發布時間);
    const dateB = new Date(b.發布時間);

    switch (sortOrder) {
      case "date-asc":
        return dateA - dateB;
      case "date-desc":
      default:
        return dateB - dateA;
    }
  });

  // 修正：計算當前可見（符合篩選條件）且被勾選的新聞數量
  const downloadableCount = Array.from(selectedNews).filter(
    (item) => sourceFilter.size === 0 || sourceFilter.has(item.來源)
  ).length;

  // ... 這邊省略了 JSX 的部分，因為它很長而且您已經有了 ...
  // ... 這裡應該是您原本 App.jsx 中的 return (...) 部分 ...
  // ... 如果您需要完整的 JSX，請告訴我 ...

  return (
    <div className="container">
      <div className="header">
        <h1> 🔍Klim Searcher</h1>
        <p>Stop Complaining, Cuddle With Me.🤗</p>
      </div>

      <div className="content">
        <form onSubmit={handleSearch} className="search-form-container">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="keyword">關鍵字</label>
              <input
                type="text"
                id="keyword"
                name="keyword"
                defaultValue="台灣"
                placeholder="輸入關鍵字..."
              />
            </div>
            <div className="form-group">
              <label htmlFor="logic">邏輯</label>
              <select id="logic" name="logic" defaultValue="OR">
                <option value="AND">AND (所有關鍵字)</option>
                <option value="OR">OR (任一關鍵字)</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="start_date">開始日期</label>
              <input
                type="date"
                id="start_date"
                name="start_date"
                defaultValue={formatDate(sevenDaysAgo)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="end_date">結束日期</label>
              <input
                type="date"
                id="end_date"
                name="end_date"
                defaultValue={formatDate(today)}
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" disabled={loading}>
              {loading ? "搜尋中..." : "搜尋新聞"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={loading || downloadableCount === 0}
              className="download-btn"
            >
              下載選中項目 ({downloadableCount})
            </button>
          </div>
        </form>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        {loading && <div className="loading">正在搜尋，請稍候...</div>}

        {stats && Object.keys(stats).length > 0 && (
          <div className="stats-container">
            <h3>新聞來源統計</h3>
            <div className="stats-list">
              {/* 功能1：讓統計項目可以點擊 */}
              {Object.entries(stats).map(([source, count]) => (
                <button
                  key={source}
                  className={`stat-item ${
                    sourceFilter.has(source) ? "active" : ""
                  }`}
                  onClick={() => handleSourceFilterClick(source)}
                >
                  {source} <span className="stat-count">{count}</span>
                </button>
              ))}
              {/* 新增：如果存在篩選條件，則顯示清除按鈕 */}
              {sourceFilter.size > 0 && (
                <button
                  className="clear-filter-btn"
                  onClick={() => setSourceFilter(new Set())}
                >
                  清除篩選
                </button>
              )}
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="results-container">
            <div className="results-header">
              <h3>搜尋結果</h3>
              <div className="sort-container">
                <label htmlFor="sort-order">排序方式：</label>
                <select
                  id="sort-order"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <option value="date-desc">日期 (由新到舊)</option>
                  <option value="date-asc">日期 (由舊到新)</option>
                </select>
              </div>
            </div>
            <ul className="news-list">
              {/* 修正：使用排序後的 sortedResults 進行渲染 */}
              {sortedResults.map((item, index) => (
                // 功能1：根據篩選條件決定是否顯示
                <li
                  key={index}
                  // 如果篩選器中有項目，且當前新聞的來源不在篩選器中，則隱藏
                  style={{
                    display:
                      sourceFilter.size > 0 && !sourceFilter.has(item.來源)
                        ? "none"
                        : "block",
                  }}
                >
                  <div className="news-item-header">
                    <input
                      type="checkbox"
                      onChange={
                        (e) => handleCheckboxChange(item, e.target.checked) // 修正：傳入 item 物件
                      }
                      // 修正：加上 checked 屬性，判斷 item 物件是否存在於 Set 中
                      checked={selectedNews.has(item)}
                      className="news-checkbox"
                    />
                    <a
                      href={item.連結}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="title"
                    >
                      {item.標題}
                    </a>
                    {item.情感 && (
                      <span
                        className={`sentiment-tag sentiment-${
                          sentimentClassMap[item.情感] || "neutral"
                        }`}
                      >
                        {item.情感}
                      </span>
                    )}
                  </div>
                  <div className="meta">
                    <span>{item.來源}</span>
                    <span>{item.發布時間}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!loading && results.length === 0 && !error && (
          <div className="empty-state">
            <p>請輸入搜尋條件以開始搜尋</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
