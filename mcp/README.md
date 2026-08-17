# Alicor SPA — MCP-коннектор для Claude

MCP-сервер, который даёт Claude доступ к производству/калькулятору Alicor SPA
через backend API `/api/ai/*`. Запускается **отдельным процессом на вашей машине**
(не в backend) и подключается к Claude Desktop как локальный stdio-коннектор.

> Инструкция для самого агента (что за сервис и правила) — в `AGENT_GUIDE.md`.
> Используйте её как system-prompt/Project instructions в Claude.

## 1. Установка (на вашем компьютере)

```bash
cd mcp
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Переменные окружения (секреты — вне репозитория)

```bash
export ALICOR_API_BASE="https://spa-planner-replaced-1767401260.emergent.host"
export ALICOR_AI_KEY="<значение AI_AGENT_SERVICE_KEY из backend .env / секрет-менеджера>"
```

`ALICOR_AI_KEY` — это сервисный ключ `AI_AGENT_SERVICE_KEY`. Он даёт полный доступ
к AI-эндпоинтам, поэтому:
- храните его только в переменных окружения / секрет-менеджере;
- никогда не кладите во фронтенд, репозиторий или логи;
- чтобы **отозвать** доступ — смените `AI_AGENT_SERVICE_KEY` в backend и передеплойте;
  старый ключ сразу перестанет работать.

## 3. Быстрая проверка

```bash
python alicor_mcp_server.py   # запустится stdio-сервер; Ctrl+C для выхода
```
(Сервер общается по stdio — «тишина» это норма; проверка через Claude ниже.)

## 4. Подключение к Claude Desktop

Откройте конфиг Claude Desktop:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Добавьте сервер (укажите абсолютные пути и python из вашего venv):

```json
{
  "mcpServers": {
    "alicor-spa": {
      "command": "/absolute/path/to/mcp/.venv/bin/python",
      "args": ["/absolute/path/to/mcp/alicor_mcp_server.py"],
      "env": {
        "ALICOR_API_BASE": "https://spa-planner-replaced-1767401260.emergent.host",
        "ALICOR_AI_KEY": "<ваш AI_AGENT_SERVICE_KEY>"
      }
    }
  }
}
```

Перезапустите Claude Desktop. В списке инструментов появятся `get_context`,
`list_orders`, `order_update_preview/apply`, `order_recalculate_preview/apply`,
`component_price_preview/apply`, `techcard_update_preview/apply` и др.

Совет: вставьте текст из `AGENT_GUIDE.md` в инструкции проекта/чата Claude, чтобы
агент понимал сервис и всегда соблюдал правило «preview → подтверждение → apply».

## 5. claude.ai (веб) / удалённый коннектор

Веб-Claude подключает **remote MCP (HTTP)** коннекторы, а не локальные stdio.
Если нужен веб-вариант — сервер можно запустить по HTTP (`mcp.run(transport="http")`)
за HTTPS-прокси с аутентификацией и зарегистрировать URL как custom connector.
Скажите — подготовлю HTTP-обёртку и инструкцию по хостингу.

## Инструменты
См. `AGENT_GUIDE.md` (полный список и сценарии). Все записи — двухшаговые
(`*_preview` → показать diff → `*_apply` с token). Цена клиента (`total`) никогда
не меняется автоматически.

---

## Remote-подключение к claude.ai (custom connector) — БЕЗ локального сервера

Помимо локального stdio-сервера, бэкенд теперь сам отдаёт remote-MCP по HTTPS
(Streamable HTTP), поэтому коннектор доступен постоянно и не завязан на ваш ПК.

**URL коннектора:**
```
https://spa-planner-replaced-1767401260.emergent.host/api/mcp
```

**Авторизация:** тип — **Request headers** (заголовок запроса).
Заголовок: `Authorization`, значение: `Bearer <MCP_BEARER_TOKEN>`.
`MCP_BEARER_TOKEN` — отдельный публичный токен коннектора (НЕ равен внутреннему
`AI_AGENT_SERVICE_KEY`, который остаётся только на сервере и наружу не выходит).

### Как добавить в claude.ai
1. Customize → Connectors → **Add custom connector**.
2. URL: `https://spa-planner-replaced-1767401260.emergent.host/api/mcp`.
3. Тип авторизации: **Request headers** → добавьте `Authorization` = `Bearer <ваш MCP_BEARER_TOKEN>`.
4. Add → Connect. Появятся инструменты (get_context, list_orders, *_preview/apply и т.д.).
5. Вставьте `AGENT_GUIDE.md` в инструкции проекта Claude.

> Заголовочная авторизация в claude.ai сейчас в бете. Если ваш аккаунт её не
> показывает — напишите, добавлю полноценный OAuth (authorize/token/DCR/PKCE);
> метаданные ресурса (`/.well-known/oauth-protected-resource`) сервер уже отдаёт,
> так что апгрейд до OAuth — следующий шаг без переделки инструментов.

Ротация доступа: смените `MCP_BEARER_TOKEN` в env бэкенда и передеплойте — старый
токен сразу перестанет работать. Внутренний `AI_AGENT_SERVICE_KEY` при этом не
меняется.

---

## OAuth-подключение к claude.ai (если нет опции «Request headers»)

Сервер теперь работает как полноценный OAuth 2.1 Authorization Server
(Dynamic Client Registration + PKCE S256). В claude.ai НЕ нужно ничего, кроме URL —
Claude сам обнаружит OAuth и проведёт вход.

**URL коннектора (тот же):**
```
https://spa-planner-replaced-1767401260.emergent.host/api/mcp
```

**Как добавить:**
1. Customize → Connectors → **Add custom connector**.
2. Вставьте URL выше. Поля Client ID / Client Secret **оставьте пустыми** (используется DCR).
3. **Add** → **Connect**.
4. Откроется страница входа «Alicor SPA — доступ для Claude» → введите **пароль доступа**
   (env `MCP_OAUTH_PASSWORD`) → «Разрешить».
5. Claude вернётся и подключит коннектор; появятся инструменты. Вставьте `AGENT_GUIDE.md`
   в инструкции проекта.

OAuth-эндпоинты (всё под `/api`, доступно через ingress):
- `/api/mcp/.well-known/oauth-protected-resource`
- `/api/mcp/.well-known/oauth-authorization-server`
- `/api/mcp/oauth/register` (DCR), `/api/mcp/oauth/authorize`, `/api/mcp/oauth/token`

Доступ по-прежнему двойной: статический `MCP_BEARER_TOKEN` (если появится опция заголовков)
ИЛИ OAuth-токен. Внутренний `AI_AGENT_SERVICE_KEY` наружу не выходит.
Ротация: смените `MCP_OAUTH_PASSWORD` (вход) и/или `MCP_BEARER_TOKEN` в env и передеплойте.
