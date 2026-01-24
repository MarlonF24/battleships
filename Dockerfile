
# Stage 1: build reaact frontend with vite
FROM node:20 AS builder 

WORKDIR /temp_frontend

COPY frontend/package*.json ./
RUN npm install 

COPY frontend/ ./
RUN npm run build

    
# Stage 2: setup python backend
FROM python:3.13-slim AS runner

WORKDIR /app

COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# copy dist folder into /app/frontend/ folder
COPY --from=builder /temp_frontend/dist/ ./frontend/dist/

COPY ./backend/ ./backend/

CMD ["fastapi", "run", "backend/controller.py"]
