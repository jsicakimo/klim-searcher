# app.py
import os
from flask import Flask, jsonify, request, send_from_directory, send_file
from datetime import datetime, date, timedelta
from collections import Counter
from io import BytesIO

# 導入您現有的新聞抓取邏輯
import pandas as pd
from multithread_fetcher import fetch_rss_news
from snownlp import SnowNLP

# --- 輔助函式 ---


def classify_sentiment(score):
    """
    根據情感分數分類
    :param score: 情感分數 (0-1)
    :return: 情感分類 ('正面', '中性', '負面')
    """
    if score > 0.65:
        return "正面"
    if score < 0.35:
        return "負面"
    return "中性"


# --- Flask App 設定 ---

# 建立一個指向 'frontend/dist' 的靜態資料夾路徑
# 這是前端專案在執行 `npm run build` 後的輸出目錄
DIST_FOLDER = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "frontend", "dist"
)

app = Flask(
    __name__,
    static_folder=os.path.join(DIST_FOLDER, "assets"),
    static_url_path="/assets",
)


# --- API 路由 ---


@app.route("/api/news", methods=["GET"])
def get_news():
    """
    提供新聞資料的 API 端點
    接收 GET 參數: keyword, days, logic
    """
    try:
        # 1. 從請求中獲取參數
        keyword = request.args.get("keyword", "台灣")
        logic = request.args.get("logic", "OR")
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")

        # 2. 設定日期範圍
        if start_date_str and end_date_str:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        else:  # 如果沒有提供日期，則使用預設的最近7天
            end_date = date.today()
            start_date = end_date - timedelta(days=7)

        # 3. 呼叫抓取函式
        news_list = fetch_rss_news(keyword, start_date, end_date, logic)

        # 進行情感分析
        if news_list:
            for item in news_list:
                sentiment_score = SnowNLP(item["標題"]).sentiments
                item["情感"] = classify_sentiment(sentiment_score)

        # 4. 產生來源統計資料
        stats = {}
        if news_list:
            source_counts = Counter(item["來源"] for item in news_list)
            # 將 Counter 物件轉換為按數量降序排列的字典
            stats = dict(source_counts.most_common())

        # 5. 回傳 JSON 格式的結果
        return jsonify(
            {
                "success": True,
                "count": len(news_list),
                "data": news_list,
                "stats": stats,
            }
        )

    except Exception as e:
        print(f"API 錯誤: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/download-selected", methods=["POST"])
def download_selected():
    """
    接收選中的新聞列表，並回傳一個 Excel 檔案供下載。
    """
    try:
        selected_news = request.get_json()
        if not selected_news or not isinstance(selected_news, list):
            return (
                jsonify({"success": False, "error": "沒有提供選中的新聞或格式錯誤"}),
                400,
            )

        # 將選中的新聞轉換為 DataFrame
        df = pd.DataFrame(selected_news)

        # 建立一個記憶體中的二進位流來儲存 Excel 檔案
        output = BytesIO()
        # 直接將 DataFrame 寫入 BytesIO，並指定引擎
        df.to_excel(
            output, index=False, sheet_name="Selected News", engine="xlsxwriter"
        )
        # 將指標移至檔案開頭
        output.seek(0)

        # 使用 send_file 將記憶體中的檔案回傳給使用者
        return send_file(
            output,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=f"selected_news_{datetime.now().strftime('%Y%m%d')}.xlsx",
        )

    except Exception as e:
        print(f"下載選中新聞時發生錯誤: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# --- 前端頁面路由 ---


@app.route("/")
def index():
    """
    提供主頁面 (index.html)
    """
    # 確保 dist 資料夾存在
    if not os.path.exists(DIST_FOLDER):
        return (
            "前端檔案尚未建置 (frontend/dist not found)。請在 'frontend' 目錄下執行 'npm run build'。",
            404,
        )

    # 提供 dist 資料夾中的 index.html
    return send_from_directory(DIST_FOLDER, "index.html")


# --- 主程式執行 ---

if __name__ == "__main__":
    # 在部署到 Render 時，這段程式碼不會被執行。
    # Render 會使用 Gunicorn (在 render.yaml 中定義) 來啟動應用。
    # 這段程式碼僅供在本機開發時使用。
    app.run(debug=True, port=5000)
