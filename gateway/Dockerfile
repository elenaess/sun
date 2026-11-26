FROM python:3.13-slim
WORKDIR /sun
COPY gateway/server.py gateway/server.py
COPY app/src/main/assets/cinema/catalog.json app/src/main/assets/cinema/catalog.json
USER 65534:65534
ENV PORT=8080 PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["python", "gateway/server.py"]
