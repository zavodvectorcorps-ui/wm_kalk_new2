"""Default prices data for Sauna calculator."""

default_sauna_prices = {
    "models": [
        {"id": "sauna_kwadro_beczka_235x200_cm", "name": "Sauna Kwadro-Beczka 235x200 cm", "basePrice": 14200, "foundationPrice": 150, "discount": 10, "imageUrl": "https://i.imgur.com/hzOjw2G.jpeg", "sortOrder": 1, "active": True},
        {"id": "sauna_kwadro_beczka_235x250_cm", "name": "Sauna Kwadro-Beczka 235x250 cm", "basePrice": 17980, "foundationPrice": 200, "discount": 10, "imageUrl": "https://i.imgur.com/LbbjL2d.jpeg", "sortOrder": 2, "active": True},
        {"id": "sauna_kwadro_beczka_235x300_cm", "name": "Sauna Kwadro-Beczka 235x300 cm", "basePrice": 24100, "foundationPrice": 250, "discount": 8, "imageUrl": "https://i.imgur.com/2Hk8SaX.jpeg", "sortOrder": 3, "active": True},
        {"id": "sauna_kwadro_beczka_235x350_cm", "name": "Sauna Kwadro-Beczka 235x350 cm", "basePrice": 26770, "foundationPrice": 300, "discount": 8, "imageUrl": "https://i.imgur.com/JacJT18.jpeg", "sortOrder": 4, "active": True},
        {"id": "sauna_kwadro_beczka_235x400_cm", "name": "Sauna Kwadro-Beczka 235x400 cm", "basePrice": 29780, "foundationPrice": 350, "discount": 7, "imageUrl": "https://i.imgur.com/pJhd5hG.jpeg", "sortOrder": 5, "active": True},
        {"id": "sauna_kwadro_beczka_235x500_cm", "name": "Sauna Kwadro-Beczka 235x500 cm", "basePrice": 33180, "foundationPrice": 400, "discount": 5, "imageUrl": "https://i.imgur.com/rzD46tD.jpeg", "sortOrder": 6, "active": True},
        {"id": "sauna_kwadro_beczka_235x600_cm", "name": "Sauna Kwadro-Beczka 235x600 cm", "basePrice": 38280, "foundationPrice": 450, "discount": 5, "imageUrl": "https://i.imgur.com/LhEbZnJ.jpeg", "sortOrder": 7, "active": True},
        {"id": "sauna_beczka_235x200_cm", "name": "Sauna Beczka 235x200 cm", "basePrice": 12800, "foundationPrice": 150, "discount": 0, "imageUrl": "https://i.imgur.com/4UCP9c1.jpeg", "sortOrder": 8, "active": True},
        {"id": "sauna_beczka_235x250_cm", "name": "Sauna Beczka 235x250 cm", "basePrice": 15800, "foundationPrice": 200, "discount": 0, "imageUrl": "https://i.imgur.com/4japDW5.jpeg", "sortOrder": 9, "active": True},
        {"id": "sauna_beczka_235x300_cm", "name": "Sauna Beczka 235x300 cm", "basePrice": 21800, "foundationPrice": 250, "discount": 0, "imageUrl": "https://i.imgur.com/MxafYj4.jpeg", "sortOrder": 10, "active": True},
        {"id": "sauna_beczka_235x350_cm", "name": "Sauna Beczka 235x350 cm", "basePrice": 24300, "foundationPrice": 300, "discount": 0, "imageUrl": "https://i.imgur.com/IVx6NJr.jpeg", "sortOrder": 11, "active": True},
        {"id": "sauna_beczka_235x400_cm", "name": "Sauna Beczka 235x400 cm", "basePrice": 26800, "foundationPrice": 350, "discount": 0, "imageUrl": "https://i.imgur.com/Ierf7jw.jpeg", "sortOrder": 12, "active": True},
        {"id": "sauna_beczka_235x450_cm", "name": "Sauna Beczka 235x450 cm", "basePrice": 28300, "foundationPrice": 400, "discount": 0, "imageUrl": "https://i.imgur.com/QSWLalW.jpeg", "sortOrder": 13, "active": True},
    ],
    "modelsDisplayType": "grid",
    "categories": [
        {
            "id": "kolor",
            "name": "Kolor",
            "inputType": "radio",
            "displayType": "dropdown",
            "options": [
                {"id": "impregnacja_gratis", "name": "Impregnacja zewnętrzna w dowolnym wybranym kolorze Gratis", "price": 0, "inputType": "radio", "sortOrder": 1}
            ]
        },
        {
            "id": "piece",
            "name": "Piece",
            "inputType": "radio",
            "displayType": "dropdown",
            "options": [
                {"id": "bez_pieca", "name": "Bez pieca", "price": 0, "inputType": "radio", "sortOrder": 1},
                {"id": "piec_elektryczny_9kw", "name": "Piec Elektryczne 9 kW", "price": 2600, "inputType": "radio", "sortOrder": 2},
                {"id": "piec_drewno_wew_12kw", "name": "Piec na Drewno / załadunek wewnętrzna / 12kW", "price": 4000, "inputType": "radio", "sortOrder": 3},
                {"id": "piec_drewno_zew_12kw", "name": "Piec na Drewno / z załadunkiem zewnętrznym / 12kW", "price": 4650, "inputType": "radio", "sortOrder": 4},
                {"id": "piec_drewno_wew_18kw", "name": "Piec na Drewno / załadunek wewnętrzna / 18kW", "price": 5600, "inputType": "radio", "sortOrder": 5},
                {"id": "piec_drewno_zew_18kw", "name": "Piec na Drewno / z załadunkiem zewnętrznym / 18kW", "price": 6250, "inputType": "radio", "sortOrder": 6}
            ]
        },
        {
            "id": "strona_pieca",
            "name": "Strona Pieca:",
            "inputType": "radio",
            "displayType": "dropdown",
            "options": [
                {"id": "piec_wprost", "name": "Piec wprost", "price": 0, "inputType": "radio", "sortOrder": 1},
                {"id": "piec_lewo", "name": "Piec lewo", "price": 350, "inputType": "radio", "sortOrder": 2},
                {"id": "piec_prawo", "name": "Piec prawo", "price": 350, "inputType": "radio", "sortOrder": 3}
            ]
        },
        {
            "id": "zbiornik_wody",
            "name": "Zbiornik na wodę na piec",
            "inputType": "radio",
            "displayType": "dropdown",
            "options": [
                {"id": "zbiornik_nie", "name": "Zbiornik na wodę na piec - Nie", "price": 0, "inputType": "radio", "sortOrder": 1},
                {"id": "zbiornik_30l", "name": "Zbiornik na wodę na piec 30L", "price": 890, "inputType": "radio", "sortOrder": 2},
                {"id": "zbiornik_50l", "name": "Zbiornik na wodę na piec 50L", "price": 990, "inputType": "radio", "sortOrder": 3}
            ]
        },
        {
            "id": "ogrodzenie_pieca",
            "name": "Ogrodzenie do pieca (drewniane)",
            "inputType": "checkbox",
            "displayType": "grid",
            "options": [
                {"id": "ogrodzenie_drewniane", "name": "Ogrodzenie do pieca (drewniane)", "price": 490, "inputType": "checkbox", "sortOrder": 1}
            ]
        },
        {
            "id": "drzwi",
            "name": "Drzwi",
            "inputType": "radio",
            "displayType": "dropdown",
            "options": [
                {"id": "drzwi_szklane_gratis", "name": "Drzwi szklane hartowane 8mm gratis", "price": 0, "inputType": "radio", "sortOrder": 1},
                {"id": "drzwi_szklane_hartowane", "name": "Drzwi wejściowe do łaźni wykonane są ze szkła hartowanego", "price": 530, "inputType": "radio", "sortOrder": 2},
                {"id": "drzwi_drewniane", "name": "Drzwi drewniane z dużym przeszkleniem (zamykane)", "price": 990, "inputType": "radio", "sortOrder": 3}
            ]
        },
        {
            "id": "lokalizacja_drzwi",
            "name": "Lokalizacja drzwi",
            "inputType": "radio",
            "displayType": "dropdown",
            "options": [
                {"id": "drzwi_wprost", "name": "Lokalizacja drzwi wprost", "price": 0, "inputType": "radio", "sortOrder": 1},
                {"id": "drzwi_boczne", "name": "Lokalizacja drzwi bocznych", "price": 1170, "inputType": "radio", "sortOrder": 2}
            ]
        },
        {
            "id": "okna",
            "name": "Okna",
            "inputType": "checkbox",
            "displayType": "grid",
            "options": [
                {"id": "okno_42x42", "name": "Okno otwierane 42x42 cm", "price": 420, "inputType": "checkbox", "sortOrder": 1},
                {"id": "extra_okno_42x42", "name": "Extra Okno otwierane 42x42 cm", "price": 420, "inputType": "checkbox", "sortOrder": 2},
                {"id": "okno_50x60", "name": "Okno otwierane 50x60 cm", "price": 650, "inputType": "checkbox", "sortOrder": 3},
                {"id": "extra_okno_50x60", "name": "Extra Okno otwierane 50x60 cm", "price": 650, "inputType": "checkbox", "sortOrder": 4},
                {"id": "okno_120x50", "name": "Okno otwierane 120x50 cm", "price": 1190, "inputType": "checkbox", "sortOrder": 5},
                {"id": "extra_okno_120x50", "name": "Extra Okno otwierane 120x50 cm", "price": 1190, "inputType": "checkbox", "sortOrder": 6}
            ]
        },
        {
            "id": "szyba_panoramiczna",
            "name": "Szyba połpanoramiczna",
            "inputType": "radio",
            "displayType": "dropdown",
            "options": [
                {"id": "szyba_nie", "name": "Szyba połpanoramiczna- Nie", "price": 0, "inputType": "radio", "sortOrder": 1},
                {"id": "szyba_80x160", "name": "Szyba połpanoramiczna 80x160 cm", "price": 980, "inputType": "radio", "sortOrder": 2},
                {"id": "szyba_160x160", "name": "Szyba panoramiczna 160x160 cm", "price": 1980, "inputType": "radio", "sortOrder": 3}
            ]
        },
        {
            "id": "lawki",
            "name": "Ławki",
            "inputType": "radio",
            "displayType": "grid",
            "options": [
                {"id": "lawki_standard_1", "name": "Standart (1 poziom)", "price": 0, "inputType": "radio", "sortOrder": 1, "imageUrl": "https://i.imgur.com/ff4dvj5.jpeg"},
                {"id": "lawki_standard_katowy", "name": "Standart kątowy (1 poziom)", "price": 0, "inputType": "radio", "sortOrder": 2, "imageUrl": "https://i.imgur.com/EH6e0Oe.jpeg"},
                {"id": "lawki_2_poziomy_otwarte", "name": "Ławki 2-poziomowe nie są zamknięte 55 cm", "price": 480, "inputType": "radio", "sortOrder": 3, "imageUrl": "https://i.imgur.com/lNi4r5Q.jpeg"},
                {"id": "lawki_2_poziomy_zamkniete", "name": "Premium Ławki 2 poziomy zamknięte 55 cm", "price": 980, "inputType": "radio", "sortOrder": 4, "imageUrl": "https://i.imgur.com/F8HtCTo.jpeg"},
                {"id": "lawki_2_poziomy_przesuwane", "name": "Premium Ławki 2 poziomy nie są zamknięte dolne przesuwane 55 cm", "price": 1580, "inputType": "radio", "sortOrder": 5, "imageUrl": "https://i.imgur.com/udSAwBt.jpeg"}
            ]
        },
        {
            "id": "oswietlenie",
            "name": "Oswietlenie",
            "inputType": "checkbox",
            "displayType": "grid",
            "options": [
                {"id": "led_gratis", "name": "LED oświetlenie przebieralni i łaźni gratis", "price": 0, "inputType": "checkbox", "sortOrder": 1},
                {"id": "lampa_standard", "name": "Lampa STANDARD (w każdym pomieszczeniu)", "price": 0, "inputType": "checkbox", "sortOrder": 2},
                {"id": "led_rgb", "name": "Oświetlenie LED RGB (dedykowane pod ławkami)", "price": 580, "inputType": "checkbox", "sortOrder": 3},
                {"id": "led_neon", "name": "Oświetlenie LED NEON (zewnętrzny pasek led zwykle wokół drzwi i okien albo krawędź sauny) do wyboru", "price": 970, "inputType": "checkbox", "sortOrder": 4},
                {"id": "led_przebieralnia", "name": "Oświetlenie LED przebieralnia", "price": 580, "inputType": "checkbox", "sortOrder": 5},
                {"id": "lampa_zewnetrzna", "name": "Dodatkowa lampa zewnętrzna", "price": 390, "inputType": "checkbox", "sortOrder": 6},
                {"id": "premium_oswietlenie", "name": "Premium Oświetlenie pomieszczeń", "price": 1500, "inputType": "checkbox", "sortOrder": 7}
            ]
        },
        {
            "id": "opcje_dodatkowe",
            "name": "Opcje Dodatkowe",
            "inputType": "checkbox",
            "displayType": "grid",
            "options": [
                {"id": "grzejnik_30l", "name": "Grzejnik elektryczny na wodę 30L + Brodzik + Prysznic", "price": 2800, "inputType": "checkbox", "sortOrder": 1},
                {"id": "grzejnik_50l", "name": "Grzejnik elektryczny na wodę 50L + Brodzik + Prysznic", "price": 2950, "inputType": "checkbox", "sortOrder": 2},
                {"id": "stol_relaksacyjny", "name": "Duży stół do pokoju relaksacyjnego", "price": 360, "inputType": "checkbox", "sortOrder": 3},
                {"id": "lezak_ergonomiczny", "name": "Ergonomiczny profilowany leżak", "price": 1850, "inputType": "checkbox", "sortOrder": 4},
                {"id": "lawka_skrzynia", "name": "Ławka ze skrzynią do przechowywania", "price": 340, "inputType": "checkbox", "sortOrder": 5},
                {"id": "schody", "name": "Schody przed wejściem", "price": 540, "inputType": "checkbox", "sortOrder": 6},
                {"id": "dach_wejscie", "name": "Dach nad wejściem przy opcji wejścia ftontowego", "price": 610, "inputType": "checkbox", "sortOrder": 7},
                {"id": "taras_zewnetrzny", "name": "Extra Taras Zewnętrzny (50cm 2 Lawki)", "price": 950, "inputType": "checkbox", "sortOrder": 8}
            ]
        },
        {
            "id": "fundament",
            "name": "Belki podłużne do podstawy ramy sauny",
            "inputType": "radio",
            "displayType": "dropdown",
            "options": [
                {"id": "belki_nie", "name": "Belki podłużne - Nie", "price": 0, "inputType": "radio", "sortOrder": 1},
                {"id": "belki_dodaj", "name": "Dodaj do sauny Belki podłużne", "price": 0, "inputType": "radio", "sortOrder": 2}
            ]
        },
        {
            "id": "dostawa",
            "name": "Dostawa",
            "inputType": "radio",
            "displayType": "dropdown",
            "options": [
                {"id": "odbior_osobisty", "name": "Odbiór osobisty", "price": 0, "inputType": "radio", "sortOrder": 1},
                {"id": "dostawa_1_100km", "name": "Dostawa 1 (1-100km)", "price": 950, "inputType": "radio", "sortOrder": 2},
                {"id": "dostawa_101_250km", "name": "Dostawa 2 (101-250km)", "price": 1200, "inputType": "radio", "sortOrder": 3},
                {"id": "dostawa_251_400km", "name": "Dostawa 3 (251-400km)", "price": 1800, "inputType": "radio", "sortOrder": 4},
                {"id": "dostawa_401_650km", "name": "Dostawa 4 (401-650km)", "price": 2300, "inputType": "radio", "sortOrder": 5}
            ]
        }
    ]
}
