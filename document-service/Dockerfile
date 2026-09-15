# WorkoutOrganizer document-service (FastAPI + OpenRouter)
# Contexto de build: ./document-service

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# catalog.py abre o banco em ROOT_DIR/../workout.db, então o código fica em
# /app/document-service e o compose monta workout.db (somente leitura) em /app/.
WORKDIR /app/document-service

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV HOST=0.0.0.0 \
    PORT=5200
EXPOSE 5200

# main.py lê HOST/PORT e chama o uvicorn — o mesmo caminho do `python main.py` local.
CMD ["python", "main.py"]
