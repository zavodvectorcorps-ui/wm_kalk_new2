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
