"""E2E-ish test: a client (same amocrm_id) with BOTH a sauna and a balia order
gets BOTH КП attached to the generated contract as separate appendices."""
import asyncio
import io
import os

_LOOP = asyncio.new_event_loop()


def _run(coro):
    return _LOOP.run_until_complete(coro)


def _make_pdf(text: str) -> bytes:
    from reportlab.pdfgen import canvas
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(100, 700, text)
    c.showPage()
    c.save()
    return buf.getvalue()


def test_contract_attaches_both_sauna_and_balia_kp():
    from database import db
    from routes import contract_template as ct

    AMO = "TEST-CONTRACT-AMO-1"
    LEAD_ID = "test-lead-multi-kp"
    SAUNA_ID = "ALS-TEST-CONTRACT-1"
    BALIA_ID = "ALB-TEST-CONTRACT-1"

    async def _run_coro():
        # cleanup any leftovers
        await db.sauna_crm_leads.delete_many({"id": LEAD_ID})
        await db.sauna_orders.delete_many({"id": SAUNA_ID})
        await db.orders.delete_many({"id": BALIA_ID})
        await db.calculator_pdfs.delete_many({"order_id": {"$in": [SAUNA_ID, BALIA_ID]}})

        # sauna order + its КП
        await db.sauna_orders.insert_one({
            "id": SAUNA_ID, "amocrm_id": AMO, "source": "manual",
            "fullName": "Multi KP Client", "phoneNumber": "+48000",
        })
        await db.calculator_pdfs.insert_one({
            "order_id": SAUNA_ID, "amocrm_id": AMO,
            "pdf_data": _make_pdf("SAUNA KP"),
        })
        # balia order + its КП (same amocrm_id)
        await db.orders.insert_one({
            "id": BALIA_ID, "amocrm_id": AMO, "source": "manual",
            "fullName": "Multi KP Client", "phoneNumber": "+48000",
        })
        await db.calculator_pdfs.insert_one({
            "order_id": BALIA_ID, "amocrm_id": AMO,
            "pdf_data": _make_pdf("BALIA KP"),
        })
        # lead linked to the sauna order
        await db.sauna_crm_leads.insert_one({
            "id": LEAD_ID, "amocrm_id": AMO, "clientName": "Multi KP Client",
            "calculatorOrderId": SAUNA_ID, "calculatorCollection": "sauna_orders",
            "documents": [],
        })

        try:
            res = await ct.generate_contract_with_kp(LEAD_ID)
            assert res.get("kpAttached") is True, f"kp not attached: {res}"

            # Download the generated contract and count appendices
            url = res.get("contractUrl")
            assert url, "no contractUrl"
            if url.startswith("/api/static/contracts/"):
                path = os.path.join("/app/backend/static/contracts", url.rsplit("/", 1)[-1])
                data = open(path, "rb").read()
            else:
                data = await ct._download_file(url)
            from docx import Document
            doc = Document(io.BytesIO(data))
            headers = [p.text for p in doc.paragraphs if "Załącznik" in p.text]
            joined = " | ".join(headers)
            assert any("Sauna" in h for h in headers), f"no Sauna appendix: {joined}"
            assert any("Balia" in h for h in headers), f"no Balia appendix: {joined}"
            print("APPENDICES:", joined)
        finally:
            await db.sauna_crm_leads.delete_many({"id": LEAD_ID})
            await db.sauna_orders.delete_many({"id": SAUNA_ID})
            await db.orders.delete_many({"id": BALIA_ID})
            await db.calculator_pdfs.delete_many({"order_id": {"$in": [SAUNA_ID, BALIA_ID]}})

    _run(_run_coro())
