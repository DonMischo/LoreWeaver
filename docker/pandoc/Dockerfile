FROM pandoc/latex:latest-ubuntu

# Install Python + pip (Ubuntu uses apt-get, not apk)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install FastAPI / uvicorn in a venv to avoid PEP 668 conflict
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir fastapi uvicorn

WORKDIR /app
COPY main.py .

EXPOSE 8082

# Reset ENTRYPOINT so CMD works as the actual command
ENTRYPOINT []
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8082"]