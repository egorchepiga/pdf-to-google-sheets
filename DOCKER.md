# Docker Setup for PDF to Sheet Extension

## О графике из Docker на Windows

**Вопрос**: Можно ли пробрасывать графику из Docker Desktop на Windows?

**Ответ**: Технически да, но **не рекомендуется** для Chrome расширений:

### Почему НЕ использовать GUI Chrome в Docker:

1. **Сложность**: Требует X11 forwarding или VNC
2. **Производительность**: Медленно и ресурсоемко
3. **Совместимость**: Chrome Extension APIs могут работать некорректно
4. **Windows**: X11 нативно не поддерживается, нужен WSL2 + X Server

### Рекомендуемый подход:

```
┌─────────────────────────────────────┐
│  Docker Container                   │
│  - Build (Vite)                     │
│  - Test (Jest - unit/integration)   │
│  - Playwright (headless E2E)        │
└─────────────────────────────────────┘
              ↓
         dist/ folder
              ↓
┌─────────────────────────────────────┐
│  Host Machine (Windows)             │
│  - Chrome Browser                   │
│  - Load unpacked extension          │
│  - Manual testing                   │
└─────────────────────────────────────┘
```

---

## Использование Docker

### Quick Start

```bash
# Development mode (Vite dev server)
docker-compose up dev

# Run tests
docker-compose up test

# Build production
docker-compose up build

# Test with coverage
docker-compose up test-coverage
```

### Доступ к dev server

После `docker-compose up dev`:
- URL: http://localhost:5173
- Hot reload работает через volume mount
- Изменения в коде обновляются автоматически

### Тестирование расширения в Chrome

**Шаг 1**: Соберите extension в Docker
```bash
docker-compose up build
```

**Шаг 2**: На хосте (Windows) загрузите в Chrome
```bash
1. Откройте chrome://extensions
2. Developer mode ON
3. Load unpacked → выберите dist/
```

**Почему так**:
- Docker собирает код (быстро, изолированно)
- Chrome на хосте тестирует UI (нативная производительность)

---

## Команды Docker

### Разработка

```bash
# Запустить dev server
docker-compose up dev

# Rebuild при изменении package.json
docker-compose up --build dev

# Остановить все контейнеры
docker-compose down
```

### Тестирование

```bash
# Юнит-тесты
docker-compose run --rm test npm run test:unit

# Интеграционные тесты
docker-compose run --rm test npm run test:integration

# Все тесты с coverage
docker-compose up test-coverage

# Watch mode (пересборка при изменениях)
docker-compose run --rm test npm run test:watch
```

### Сборка

```bash
# Production build
docker-compose up build

# Результат в dist/
ls dist/

# Очистить dist/
docker-compose run --rm build rm -rf dist
```

### Очистка

```bash
# Удалить все контейнеры и образы
docker-compose down --rmi all

# Удалить volumes
docker-compose down -v

# Полная очистка
docker system prune -a
```

---

## Headless E2E тестирование (Playwright)

Для автоматизированного тестирования БЕЗ GUI:

```bash
# Установить Playwright
npm install --save-dev @playwright/test

# Запустить E2E тесты в Docker
docker-compose up e2e
```

**Что тестируется**:
- Загрузка расширения в headless Chrome
- Базовая функциональность (парсинг PDF)
- API вызовы (mock Google API)
- НЕ тестируется: UI interactions (клики, drag-and-drop)

---

## Volumes и синхронизация

### Volume mounts в docker-compose.yml

```yaml
volumes:
  - .:/app              # Синхронизация всего проекта
  - /app/node_modules   # Exclude node_modules (используем из контейнера)
  - ./dist:/app/dist    # Output dist/ на хост
```

### Что синхронизируется:

- ✅ Исходники (src/, tests/)
- ✅ Конфиги (manifest.json, vite.config.ts)
- ✅ Результаты сборки (dist/)
- ❌ node_modules (используем из контейнера)

---

## CI/CD Pipeline

Для GitHub Actions / GitLab CI:

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: docker/setup-buildx-action@v2

      - name: Run tests
        run: docker-compose up --exit-code-from test test

      - name: Build extension
        run: docker-compose up build

      - name: Upload dist
        uses: actions/upload-artifact@v3
        with:
          name: extension-build
          path: dist/
```

---

## Troubleshooting

### Problem: "Permission denied" на Windows

**Solution**:
```bash
# В WSL2
sudo chown -R $USER:$USER .

# Или в docker-compose.yml добавить:
user: "1000:1000"
```

### Problem: Changes не обновляются в контейнере

**Solution**:
```bash
# Пересоздать контейнеры
docker-compose up --build --force-recreate
```

### Problem: node_modules из контейнера не работают

**Solution**:
```bash
# Удалить локальный node_modules
rm -rf node_modules

# Пересоздать volume
docker-compose down -v
docker-compose up --build
```

### Problem: Canvas errors при генерации PDF

**Solution**: Проверьте что установлены system deps:
```dockerfile
RUN apk add --no-cache cairo-dev jpeg-dev pango-dev
```

---

## Альтернатива: VS Code Dev Containers

Для разработки в VS Code:

**.devcontainer/devcontainer.json**:
```json
{
  "name": "PDF to Sheet Dev",
  "dockerComposeFile": "../docker-compose.yml",
  "service": "dev",
  "workspaceFolder": "/app",
  "extensions": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode"
  ],
  "forwardPorts": [5173]
}
```

Затем: `Ctrl+Shift+P` → "Reopen in Container"

---

## Рекомендации

### ✅ Используйте Docker для:
- CI/CD pipeline
- Юнит и интеграционные тесты
- Production build
- Headless E2E тесты
- Изоляция зависимостей

### ❌ НЕ используйте Docker для:
- Ручное тестирование UI
- Отладка Chrome Extension APIs
- Drag-and-drop тестирование
- OAuth flow тестирование

### 🎯 Best Practice:
1. **Локальная разработка**: VS Code + npm run dev (на хосте)
2. **Тестирование**: docker-compose up test
3. **Сборка**: docker-compose up build
4. **Ручные тесты**: Chrome на хосте (dist/)
5. **CI/CD**: Полностью в Docker

---

## Производительность

### Сравнение времени (примерно):

| Task | Native (Windows) | Docker |
|------|------------------|--------|
| npm install | 15s | 20s |
| npm run build | 1.5s | 2s |
| npm test | 5s | 6s |
| Dev server start | 0.5s | 0.7s |

**Вывод**: Разница минимальна благодаря volume caching.

---

## Заключение

**Для Chrome Extension разработки**:
- Docker - отлично для BUILD и TEST
- Локальный Chrome - необходим для MANUAL testing
- Гибридный подход = оптимальное решение

Графику из Docker на Windows пробрасывать можно, но сложно и не нужно для нашей задачи.
