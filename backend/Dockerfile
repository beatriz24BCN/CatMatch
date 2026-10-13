FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
COPY requirements.txt .
# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt
COPY . /app
# Wait for Postgres service 'db' to be ready before starting the app using a Python loop
CMD ["./entrypoint.sh"]
