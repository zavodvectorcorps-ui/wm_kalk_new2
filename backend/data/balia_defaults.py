"""Default prices data for Balia (Hottub) calculator."""

default_balia_prices = {
    # ========== MODELS ==========
    "models": [
        {
            "id": "round_ext_200",
            "name": "Hottub 200cm (External heater)",
            "nameRu": "Купель 200см (внешний нагрев)",
            "namePl": "Balia 200cm (zewnętrzny piec)",
            "type": "fiberglass",
            "shape": "round",
            "size": "200",
            "heaterType": "external",
            "specs": {
                "outerDiameter": 200,
                "innerDiameter": 185,
                "depth": 95,
                "totalHeight": 105,
                "heaterPower": 38,
                "waterCapacity": 1000
            },
            "basePrice": 1250,
            "currency": "EUR",
            "sortOrder": 1,
            "active": True
        },
        {
            "id": "round_ext_225",
            "name": "Hottub 225cm (External heater)",
            "nameRu": "Купель 225см (внешний нагрев)",
            "namePl": "Balia 225cm (zewnętrzny piec)",
            "type": "fiberglass",
            "shape": "round",
            "size": "225",
            "heaterType": "external",
            "specs": {
                "outerDiameter": 225,
                "innerDiameter": 204,
                "depth": 95,
                "totalHeight": 105,
                "heaterPower": 38,
                "waterCapacity": 1400
            },
            "basePrice": 1450,
            "currency": "EUR",
            "sortOrder": 2,
            "active": True
        },
        {
            "id": "round_int_200",
            "name": "Hottub 200cm (Integrated heater)",
            "nameRu": "Купель 200см (встроенный нагрев)",
            "namePl": "Balia 200cm (zintegrowany piec)",
            "type": "fiberglass",
            "shape": "round",
            "size": "200",
            "heaterType": "integrated",
            "specs": {
                "outerDiameter": 200,
                "innerDiameter": 185,
                "depth": 95,
                "totalHeight": 105,
                "heaterPower": 35,
                "waterCapacity": 1000
            },
            "basePrice": 1450,
            "currency": "EUR",
            "sortOrder": 3,
            "active": True
        },
        {
            "id": "round_int_225",
            "name": "Hottub 225cm (Integrated heater)",
            "nameRu": "Купель 225см (встроенный нагрев)",
            "namePl": "Balia 225cm (zintegrowany piec)",
            "type": "fiberglass",
            "shape": "round",
            "size": "225",
            "heaterType": "integrated",
            "specs": {
                "outerDiameter": 225,
                "innerDiameter": 204,
                "depth": 95,
                "totalHeight": 105,
                "heaterPower": 35,
                "waterCapacity": 1400
            },
            "basePrice": 1650,
            "currency": "EUR",
            "sortOrder": 4,
            "active": True
        },
        {
            "id": "square_acrylic_230",
            "name": "Square Acrylic 230x230cm (Integrated)",
            "nameRu": "Квадратная акриловая 230x230см",
            "namePl": "Kwadratowa akrylowa 230x230cm",
            "type": "acrylic",
            "shape": "square",
            "size": "230x230",
            "heaterType": "integrated",
            "specs": {
                "outerWidth": 230,
                "outerLength": 230,
                "innerWidth": 200,
                "innerLength": 200,
                "depth": 86,
                "totalHeight": 95,
                "heaterPower": 35,
                "waterCapacity": 1600
            },
            "includes": ["closed_step", "heater", "heater_accessories", "beverage_holder", "thermowood", "thermal_cover"],
            "basePrice": 2750,
            "currency": "EUR",
            "sortOrder": 5,
            "active": True
        }
    ],
    
    # ========== CATEGORIES ==========
    "categories": [
        {
            "id": "hydromassage",
            "name": "Hydromassage",
            "nameRu": "Гидромассаж",
            "namePl": "Hydromasaż",
            "inputType": "radio",
            "displayType": "dropdown",
            "sortOrder": 1,
            "options": [
                {"id": "none_hydro", "name": "Without hydromassage", "nameRu": "Без гидромассажа", "namePl": "Bez hydromasażu", "price": 0, "sortOrder": 1},
                {"id": "hydro_6_8", "name": "Hydromassage 1.1kW (6-8 jets)", "nameRu": "Гидромассаж 1.1кВт (6-8 форсунок)", "namePl": "Hydromasaż 1.1kW (6-8 dysz)", "price": 300, "sortOrder": 2},
                {"id": "hydro_10", "name": "Hydromassage 1.1kW (10 jets)", "nameRu": "Гидромассаж 1.1кВт (10 форсунок)", "namePl": "Hydromasaż 1.1kW (10 dysz)", "price": 320, "sortOrder": 3}
            ]
        },
        {
            "id": "air_bubble",
            "name": "Air Bubble System",
            "nameRu": "Воздушные пузырьки",
            "namePl": "System bąbelków powietrza",
            "inputType": "checkbox",
            "displayType": "grid",
            "sortOrder": 2,
            "options": [
                {"id": "air_bubble", "name": "Air bubble 0.7kW (12-18 nozzles)", "nameRu": "Воздушные пузырьки 0.7кВт (12-18 форсунок)", "namePl": "Bąbelki powietrza 0.7kW (12-18 dysz)", "price": 300, "sortOrder": 1}
            ]
        },
        {
            "id": "lighting",
            "name": "Lighting",
            "nameRu": "Освещение",
            "namePl": "Oświetlenie",
            "inputType": "checkbox",
            "displayType": "grid",
            "sortOrder": 3,
            "options": [
                {"id": "led_inside_1", "name": "LED inside (1 pc)", "nameRu": "LED внутри (1 шт)", "namePl": "LED wewnątrz (1 szt)", "price": 50, "sortOrder": 1},
                {"id": "led_inside_2", "name": "LED inside (2 pc)", "nameRu": "LED внутри (2 шт)", "namePl": "LED wewnątrz (2 szt)", "price": 80, "sortOrder": 2},
                {"id": "led_inside_3", "name": "LED inside (3 pc)", "nameRu": "LED внутри (3 шт)", "namePl": "LED wewnątrz (3 szt)", "price": 110, "sortOrder": 3},
                {"id": "mini_led_set", "name": "Mini LED + standard LED set", "nameRu": "Мини LED + стандартный LED набор", "namePl": "Mini LED + standardowy LED zestaw", "price": 150, "sortOrder": 4},
                {"id": "ambilight_strip", "name": "Outside LED strip (Ambilight)", "nameRu": "Внешняя LED лента (Ambilight)", "namePl": "Zewnętrzna taśma LED (Ambilight)", "price": 180, "sortOrder": 5}
            ]
        },
        {
            "id": "cover",
            "name": "Thermal Cover",
            "nameRu": "Термокрышка",
            "namePl": "Pokrywa termiczna",
            "inputType": "radio",
            "displayType": "dropdown",
            "sortOrder": 4,
            "options": [
                {"id": "no_cover", "name": "Without cover", "nameRu": "Без крышки", "namePl": "Bez pokrywy", "price": 0, "applicableTo": "all", "sortOrder": 1},
                {"id": "cover_200_with_tub", "name": "Cover 200cm (with hottub)", "nameRu": "Крышка 200см (с купелью)", "namePl": "Pokrywa 200cm (z balią)", "price": 100, "applicableTo": "round_200", "sortOrder": 2},
                {"id": "cover_200_separate", "name": "Cover 200cm (separate)", "nameRu": "Крышка 200см (отдельно)", "namePl": "Pokrywa 200cm (osobno)", "price": 180, "applicableTo": "round_200", "sortOrder": 3},
                {"id": "cover_225_with_tub", "name": "Cover 225cm (with hottub)", "nameRu": "Крышка 225см (с купелью)", "namePl": "Pokrywa 225cm (z balią)", "price": 150, "applicableTo": "round_225", "sortOrder": 4},
                {"id": "cover_225_separate", "name": "Cover 225cm (separate)", "nameRu": "Крышка 225см (отдельно)", "namePl": "Pokrywa 225cm (osobno)", "price": 250, "applicableTo": "round_225", "sortOrder": 5},
                {"id": "cover_230_separate", "name": "Cover 230x230cm (separate)", "nameRu": "Крышка 230x230см (отдельно)", "namePl": "Pokrywa 230x230cm (osobno)", "price": 350, "applicableTo": "square_230", "sortOrder": 6}
            ]
        },
        {
            "id": "cladding",
            "name": "Wood Cladding",
            "nameRu": "Обшивка деревом",
            "namePl": "Okładzina drewniana",
            "inputType": "radio",
            "displayType": "dropdown",
            "sortOrder": 5,
            "options": [
                {"id": "no_cladding", "name": "Without cladding", "nameRu": "Без обшивки", "namePl": "Bez okładziny", "price": 0, "sortOrder": 1},
                {"id": "cladding_thermo_200", "name": "Thermowood 200cm", "nameRu": "Термодерево 200см", "namePl": "Termodrewno 200cm", "price": 130, "applicableTo": "round_200", "sortOrder": 2},
                {"id": "cladding_thermo_225", "name": "Thermowood 225cm", "nameRu": "Термодерево 225см", "namePl": "Termodrewno 225cm", "price": 150, "applicableTo": "round_225", "sortOrder": 3},
                {"id": "cladding_wpc_200", "name": "WPC 200cm", "nameRu": "WPC 200см", "namePl": "WPC 200cm", "price": 220, "applicableTo": "round_200", "sortOrder": 4},
                {"id": "cladding_wpc_225", "name": "WPC 225cm", "nameRu": "WPC 225см", "namePl": "WPC 225cm", "price": 240, "applicableTo": "round_225", "sortOrder": 5},
                {"id": "cladding_cedar_200", "name": "Canadian Red Cedar 200cm", "nameRu": "Канадский красный кедр 200см", "namePl": "Kanadyjski czerwony cedr 200cm", "price": 1800, "applicableTo": "round_200", "sortOrder": 6},
                {"id": "cladding_cedar_225", "name": "Canadian Red Cedar 225cm", "nameRu": "Канадский красный кедр 225см", "namePl": "Kanadyjski czerwony cedr 225cm", "price": 2000, "applicableTo": "round_225", "sortOrder": 7}
            ]
        },
        {
            "id": "stairs_box",
            "name": "Stairs / Filter Box",
            "nameRu": "Ступени / Бокс для фильтра",
            "namePl": "Schody / Skrzynka na filtr",
            "inputType": "radio",
            "displayType": "dropdown",
            "sortOrder": 6,
            "options": [
                {"id": "no_stairs", "name": "Without stairs/box", "nameRu": "Без ступеней/бокса", "namePl": "Bez schodów/skrzynki", "price": 0, "sortOrder": 1},
                {"id": "big_stair_spruce", "name": "Big stair/box Spruce", "nameRu": "Большие ступени/бокс Ель", "namePl": "Duże schody/skrzynka Świerk", "price": 80, "sortOrder": 2},
                {"id": "big_stair_thermo", "name": "Big stair/box Thermo wood", "nameRu": "Большие ступени/бокс Термодерево", "namePl": "Duże schody/skrzynka Termodrewno", "price": 100, "sortOrder": 3},
                {"id": "big_stair_wpc", "name": "Big stair/box WPC", "nameRu": "Большие ступени/бокс WPC", "namePl": "Duże schody/skrzynka WPC", "price": 160, "sortOrder": 4},
                {"id": "big_stair_cedar", "name": "Big stair/box Canadian Red Cedar", "nameRu": "Большие ступени/бокс Канадский красный кедр", "namePl": "Duże schody/skrzynka Kanadyjski czerwony cedr", "price": 250, "sortOrder": 5}
            ]
        },
        {
            "id": "filtration",
            "name": "Filtration System",
            "nameRu": "Система фильтрации",
            "namePl": "System filtracji",
            "inputType": "radio",
            "displayType": "dropdown",
            "sortOrder": 7,
            "options": [
                {"id": "no_filter", "name": "Without filtration", "nameRu": "Без фильтрации", "namePl": "Bez filtracji", "price": 0, "sortOrder": 1},
                {"id": "sand_filter_connections", "name": "Sand filter connections only", "nameRu": "Только подключения для фильтра", "namePl": "Tylko przyłącza do filtra", "price": 30, "sortOrder": 2},
                {"id": "sand_filter_system", "name": "Sand filter system complete", "nameRu": "Полная система песочного фильтра", "namePl": "Kompletny system filtra piaskowego", "price": 200, "sortOrder": 3}
            ]
        },
        {
            "id": "insulation",
            "name": "Insulation",
            "nameRu": "Утепление",
            "namePl": "Izolacja",
            "inputType": "radio",
            "displayType": "dropdown",
            "sortOrder": 8,
            "options": [
                {"id": "no_insulation", "name": "Without insulation", "nameRu": "Без утепления", "namePl": "Bez izolacji", "price": 0, "sortOrder": 1},
                {"id": "insulation_200", "name": "Insulation 200cm", "nameRu": "Утепление 200см", "namePl": "Izolacja 200cm", "price": 80, "applicableTo": "round_200", "sortOrder": 2},
                {"id": "insulation_225", "name": "Insulation 225cm", "nameRu": "Утепление 225см", "namePl": "Izolacja 225cm", "price": 100, "applicableTo": "round_225", "sortOrder": 3}
            ]
        },
        {
            "id": "heater_upgrade",
            "name": "Heater Upgrade",
            "nameRu": "Улучшение нагревателя",
            "namePl": "Ulepszenie pieca",
            "inputType": "radio",
            "displayType": "dropdown",
            "sortOrder": 9,
            "options": [
                {"id": "no_upgrade", "name": "Standard heater", "nameRu": "Стандартный нагреватель", "namePl": "Standardowy piec", "price": 0, "sortOrder": 1},
                {"id": "v4a_integrated", "name": "V4A Stainless Steel (Integrated)", "nameRu": "V4A Нержавеющая сталь (встроенный)", "namePl": "V4A Stal nierdzewna (zintegrowany)", "price": 150, "applicableTo": "integrated", "sortOrder": 2},
                {"id": "v4a_external", "name": "V4A Stainless Steel (External)", "nameRu": "V4A Нержавеющая сталь (внешний)", "namePl": "V4A Stal nierdzewna (zewnętrzny)", "price": 120, "applicableTo": "external", "sortOrder": 3}
            ]
        },
        {
            "id": "heater_extra",
            "name": "Electric Heater (Additional)",
            "nameRu": "Электронагреватель (дополнительный)",
            "namePl": "Grzałka elektryczna (dodatkowa)",
            "inputType": "radio",
            "displayType": "dropdown",
            "sortOrder": 10,
            "options": [
                {"id": "no_electric", "name": "Without electric heater", "nameRu": "Без электронагревателя", "namePl": "Bez grzałki elektrycznej", "price": 0, "sortOrder": 1},
                {"id": "electric_heater_3", "name": "Electric heater 3kW", "nameRu": "Электронагреватель 3кВт", "namePl": "Grzałka elektryczna 3kW", "price": 250, "sortOrder": 2},
                {"id": "electric_heater_6", "name": "Electric heater 6kW", "nameRu": "Электронагреватель 6кВт", "namePl": "Grzałka elektryczna 6kW", "price": 450, "sortOrder": 3}
            ]
        },
        {
            "id": "drink_holder",
            "name": "Drink Holder",
            "nameRu": "Подставка для напитков",
            "namePl": "Uchwyt na napoje",
            "inputType": "radio",
            "displayType": "dropdown",
            "sortOrder": 11,
            "options": [
                {"id": "no_drink", "name": "Without drink holder", "nameRu": "Без подставки", "namePl": "Bez uchwytu", "price": 0, "sortOrder": 1},
                {"id": "drink_spruce", "name": "Spruce", "nameRu": "Ель", "namePl": "Świerk", "price": 30, "sortOrder": 2},
                {"id": "drink_thermo", "name": "Thermo wood", "nameRu": "Термодерево", "namePl": "Termodrewno", "price": 40, "sortOrder": 3},
                {"id": "drink_wpc", "name": "WPC", "nameRu": "WPC", "namePl": "WPC", "price": 40, "sortOrder": 4},
                {"id": "drink_cedar", "name": "Canadian Red Cedar", "nameRu": "Канадский красный кедр", "namePl": "Kanadyjski czerwony cedr", "price": 80, "sortOrder": 5},
                {"id": "drink_spruce_led", "name": "Spruce with LED", "nameRu": "Ель с LED", "namePl": "Świerk z LED", "price": 150, "sortOrder": 6},
                {"id": "drink_thermo_led", "name": "Thermo wood with LED", "nameRu": "Термодерево с LED", "namePl": "Termodrewno z LED", "price": 160, "sortOrder": 7},
                {"id": "drink_wpc_led", "name": "WPC with LED", "nameRu": "WPC с LED", "namePl": "WPC z LED", "price": 180, "sortOrder": 8},
                {"id": "drink_cedar_led", "name": "Canadian Red Cedar with LED", "nameRu": "Канадский красный кедр с LED", "namePl": "Kanadyjski czerwony cedr z LED", "price": 240, "sortOrder": 9}
            ]
        },
        {
            "id": "comfort",
            "name": "Comfort Accessories",
            "nameRu": "Аксессуары комфорта",
            "namePl": "Akcesoria komfortowe",
            "inputType": "checkbox",
            "displayType": "grid",
            "sortOrder": 12,
            "options": [
                {"id": "head_pillow", "name": "Head pillow", "nameRu": "Подголовник", "namePl": "Poduszka pod głowę", "price": 15, "sortOrder": 1}
            ]
        },
        {
            "id": "finish",
            "name": "Wood Finish",
            "nameRu": "Отделка дерева",
            "namePl": "Wykończenie drewna",
            "inputType": "checkbox",
            "displayType": "grid",
            "sortOrder": 13,
            "options": [
                {"id": "wood_paint_oil", "name": "Wood painting/oiling", "nameRu": "Покраска/масло для дерева", "namePl": "Malowanie/olejowanie drewna", "price": 50, "sortOrder": 1}
            ]
        },
        {
            "id": "electronics",
            "name": "Electronics",
            "nameRu": "Электроника",
            "namePl": "Elektronika",
            "inputType": "checkbox",
            "displayType": "grid",
            "sortOrder": 14,
            "options": [
                {"id": "bluetooth_radio", "name": "Bluetooth radio", "nameRu": "Bluetooth радио", "namePl": "Radio Bluetooth", "price": 200, "sortOrder": 1}
            ]
        }
    ],
    
    # Display settings
    "modelsDisplayType": "grid",
    "currency": "EUR",
    "currencySymbol": "€"
}
