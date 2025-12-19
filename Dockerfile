# 使用官方 Python 3.9 輕量版映像檔
FROM python:3.9-slim

# 設定容器內的工作目錄
WORKDIR /code

# 先複製 requirements.txt 並安裝依賴 (利用 Docker Layer 快取機制加速建置)
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# 複製應用程式程式碼
COPY ./app /code/app

# 設定容器啟動時執行的指令 (監聽 Port 80)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80"]
