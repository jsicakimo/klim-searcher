# multithread_fetcher.py

import threading
import feedparser
from datetime import datetime, date, timedelta
from urllib.parse import quote
import time


def build_rss_url(keyword: str) -> str:
    """根據關鍵字建立 Google News RSS URL"""
    return f"https://news.google.com/rss/search?q={quote(keyword)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"


def fetch_rss_news(
    keyword: str, start_date: date, end_date: date, logic: str = "AND"
) -> list:
    """
    使用多執行緒並行抓取多個關鍵字的 RSS 新聞 (簡單獨立版)。

    :param keyword: 搜尋關鍵字，若 logic='OR' 可用逗號分隔。
    :param start_date: 新聞起始日期 (date 物件)。
    :param end_date: 新聞結束日期 (date 物件)。
    :param logic: 'OR' 或 'AND'，決定如何處理多個關鍵字。
    :return: 一個包含新聞字典的列表。
    """
    if logic == "OR":
        keywords = [k.strip() for k in keyword.split(",")]
    else:  # AND
        keywords = [" ".join(k.strip() for k in keyword.split(","))]

    all_results = []  # 共享的結果列表
    threads = []  # 存放所有執行緒物件

    # 定義每個執行緒要執行的工作函式
    def worker(kw, s_date, e_date):
        rss_url = build_rss_url(kw)
        try:
            feed = feedparser.parse(rss_url)

            for entry in feed.entries:
                # 確保有發布時間屬性且不為 None
                if (
                    not hasattr(entry, "published_parsed")
                    or entry.published_parsed is None
                ):
                    continue

                published = datetime(*entry.published_parsed[:6])
                if s_date <= published.date() <= e_date:
                    news_item = {
                        "標題": entry.title,
                        "連結": entry.link,
                        "發布時間": published.strftime("%Y-%m-%d %H:%M:%S"),
                        "來源": (
                            entry.source.title
                            if hasattr(entry, "source")
                            and hasattr(entry.source, "title")
                            else "未知"
                        ),
                        "關鍵字": kw,
                    }
                    # list.append 是執行緒安全的，所以可以直接加入
                    all_results.append(news_item)
        except Exception as e:
            print(f"處理關鍵字 '{kw}' 時發生錯誤: {e}")

    # 建立並啟動所有執行緒
    for kw in keywords:
        thread = threading.Thread(target=worker, args=(kw, start_date, end_date))
        threads.append(thread)
        thread.start()  # 啟動執行緒，它會在背景執行

    # 等待所有執行緒完成工作
    for thread in threads:
        thread.join()  # 主程式會在此阻塞，直到該執行緒結束

    # 對所有收集到的結果進行排序
    all_results.sort(key=lambda x: x["發布時間"], reverse=True)

    return all_results


# --- 主程式執行區塊 ---
# 這段程式碼只有在直接執行 `python multithread_fetcher.py` 時才會運作
if __name__ == "__main__":
    print("--- 開始測試多執行緒新聞抓取模組 ---")

    # 1. 設定搜尋參數
    search_keyword = "NVIDIA,台積電,AI伺服器"
    search_logic = "OR"
    end_date = date.today()
    start_date = end_date - timedelta(days=7)

    print(f"搜尋關鍵字: '{search_keyword}' (邏輯: {search_logic})")
    print(f"日期範圍: {start_date} 到 {end_date}")
    print("-" * 20)

    # 2. 執行抓取並計時
    start_time = time.perf_counter()
    news_list = fetch_rss_news(search_keyword, start_date, end_date, search_logic)
    end_time = time.perf_counter()

    # 3. 顯示結果
    print(f"抓取完成！總共耗時: {end_time - start_time:.2f} 秒")
    print(f"總共抓取到 {len(news_list)} 則新聞。")

    if news_list:
        print("\n顯示所有新聞標題：")
        for i, item in enumerate(news_list):
            print(f"{i+1}. [{item['發布時間']}] {item['標題']} (來源: {item['來源']})")
