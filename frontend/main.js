// frontend/main.js

const { createApp } = Vue;

// 輔助函式：將 Date 物件格式化為 YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

createApp({
  data() {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    return {
      keyword: "海科館",
      logic: "OR",
      startDate: formatDate(sevenDaysAgo),
      endDate: formatDate(today),
      news: [],
      isLoading: false,
      stats: null,
      error: null,
    };
  },
  methods: {
    async fetchNews() {
      if (!this.keyword.trim()) {
        this.error = "請輸入搜尋關鍵字！";
        return;
      }
      if (!this.startDate || !this.endDate) {
        this.error = "請選擇起始與結束日期！";
        return;
      }
      this.isLoading = true;
      this.error = null;
      this.news = [];
      this.stats = null;

      try {
        const params = new URLSearchParams({
          keyword: this.keyword,
          logic: this.logic,
          start_date: this.startDate,
          end_date: this.endDate,
        });
        const response = await fetch(`/api/news?${params.toString()}`);
        const result = await response.json();

        if (result.success) {
          this.news = result.data;
          this.stats = result.stats;
        } else {
          this.error = `擷取失敗: ${result.error}`;
        }
      } catch (err) {
        this.error = `發生網路或伺服器錯誤: ${err.message}`;
      } finally {
        this.isLoading = false;
      }
    },
  },
  mounted() {
    // 頁面載入時自動抓取一次預設關鍵字的新聞
    this.fetchNews();
  },
}).mount("#app");
