FROM pandoc/latex:latest

# Install Python + pip
RUN apk add --no-cache python3 py3-pip

# Install FastAPI / uvicorn in a venv to avoid PEP 668 conflict
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir fastapi uvicorn[standard] python-multipart

WORKDIR /app
COPY main.py .

EXPOSE 8082
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8082"]
