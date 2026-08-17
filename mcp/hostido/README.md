# Хостинг OAuth-метаданных на hostido (al-spa.pl)

Цель: отдать 2 JSON-файла discovery в КОРНЕ домена по HTTPS с правильным
`Content-Type: application/json`. Сами OAuth-эндпоинты остаются на бэкенде Emergent.

## Что загрузить
В корень сайта `al-spa.pl` (там, где `public_html` / docroot) создайте папку
`.well-known` и положите туда 3 файла из этой папки:
```
.well-known/oauth-authorization-server
.well-known/oauth-protected-resource
.well-known/.htaccess
```
(файлы БЕЗ расширения — так и должно быть).

## Требования
1. **HTTPS с валидным SSL** для `https://al-spa.pl` (в панели hostido включите Let's Encrypt,
   если ещё не включён). Сейчас домен по HTTPS не отвечает — это надо поднять.
2. Apache с `.htaccess` (mod_mime + mod_headers). На hostido обычно включены.

## Проверка после загрузки
Откройте в браузере:
- `https://al-spa.pl/.well-known/oauth-authorization-server`
- `https://al-spa.pl/.well-known/oauth-protected-resource`
Оба должны показать JSON. Content-Type проверьте так (или через DevTools → Network):
```
curl -sI https://al-spa.pl/.well-known/oauth-authorization-server | grep -i content-type
```
Должно быть `content-type: application/json`.

## Дальше
- На бэкенде уже прописан `MCP_OAUTH_METADATA_URL=https://al-spa.pl/.well-known/oauth-protected-resource`.
- Нужен РЕДЕПЛОЙ Emergent.
- В claude.ai добавляйте коннектор по URL:
  `https://spa-planner-replaced-1767401260.emergent.host/api/mcp`
  (Client ID/Secret — пустые). Логин-пароль на странице доступа: см. MCP_OAUTH_PASSWORD.
