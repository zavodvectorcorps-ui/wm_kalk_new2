# wm-dealers.pl — DNS setup instructions

You bought `wm-dealers.pl`. To make it open the Dealer Portal, you have two options:

## Option A — Single backend, two domains (recommended)

Both `wm-kalkulator.pl` and `wm-dealers.pl` point to the **same Emergent app**. 
The frontend already auto-detects the `wm-dealers.pl` hostname and shows the Dealer Portal.

### Steps (in your domain registrar's DNS panel for `wm-dealers.pl`):

1. **A record** for the root: 
   - Name: `@` (root)
   - Type: `A`
   - Value: same IP address you currently have for `wm-kalkulator.pl` (look it up via `dig wm-kalkulator.pl +short`)
   - TTL: 3600 (or default)

2. **CNAME record** for www:
   - Name: `www`
   - Type: `CNAME`
   - Value: `wm-kalkulator.pl.`
   - TTL: 3600

3. **In Emergent dashboard** (your existing project): add `wm-dealers.pl` and `www.wm-dealers.pl` to the list of allowed custom domains. Get an SSL certificate.

That's it. Visiting `https://wm-dealers.pl/` will now show the Dealer Login page automatically.

### Why this works
The frontend (`/app/frontend/src/App.js`) checks `window.location.hostname` and switches to dealer mode whenever it sees `wm-dealer*`, `dealer.*`, or path `/dealer`. The backend CORS list has been updated to include `https://wm-dealers.pl`.

---

## Option B — Quick test before DNS is set up

Until `wm-dealers.pl` resolves, you can already use the Dealer Portal at:
- https://wm-kalkulator.pl/dealer

The same login form appears and works identically.

---

## Option C — Subdomain instead of separate domain

If you'd rather use a subdomain (`dealer.wm-kalkulator.pl`) without a separate domain:

1. **CNAME record**:
   - Name: `dealer`
   - Type: `CNAME`
   - Value: `wm-kalkulator.pl.`

2. Add `dealer.wm-kalkulator.pl` to allowed custom domains in Emergent.

The frontend already detects `dealer.*` host and switches to dealer mode.

---

## Verification after DNS propagates

```bash
# Check DNS resolves
dig wm-dealers.pl +short
# Should return the same IP as wm-kalkulator.pl

# Check HTTPS works
curl -sI https://wm-dealers.pl/dealer | head -1
# Should return 200 OK
```

DNS propagation usually takes 5-30 minutes (sometimes up to 24h depending on registrar).
