import json
import re

with open('scripts/extracted_streets.json', encoding='utf-8') as f:
    streets = json.load(f)

# Rules mapping keywords to locales
rules = {
    'French Concession': ['RUE ', 'ROUTE ', 'AVENUE JOFFRE', 'AVENUE DUBAIL', 'AVENUE PETAIN', 'AVENUE FOCH', 'QUAI DE FRANCE', 'AVENUE DU ROI ALBERT', 'BOULEVARD DES DEUX', 'RUE ', 'AVENUE EDWARD VII', 'ROUTE DE ZIKAWEI', 'CONTY', 'VALLON', 'LAFAYETTE', 'CORNEILLE', 'MOLIERE', 'MASSENET', 'MONTAUBAN', 'CONSULAT', 'DELAUNAY', 'BOURGEAT', 'FRELUPT', 'GROUCHY', 'HENRY', 'LORIOZ'],
    'Hongkew': ['WHAMPOO', 'BROADWAY', 'SEWARD', 'DIXWELL', 'BOONE', 'MILLER', 'ASTOR', 'KUNGPING', 'MUIRHEAD', 'DENT', 'FEARON', 'YUHANG', 'HAINING', 'RANGE', 'NORTH SZECHUEN', 'NORTH HONAN', 'CHAPOO', 'QUINSAN', 'WOOSUNG', 'KASHING', 'THORBURN', 'BAIKAL', 'WARD ROAD', 'WUCHOW', 'YALU', 'HANBURY'],
    'Yangtszepoo': ['YANGTSZEPOO', 'PINGLIANG', 'LAY ROAD', 'WASHING', 'LINSING', 'CHEMULPO', 'DALNY'],
    'International Settlement': ['NANKING', 'BUND', 'KIANGSE', 'SZECHUEN', 'HONAN', 'SHANTUNG', 'FUKIEN', 'THIBET', 'DEFENCE', 'CHEKIANG', 'HOOPEH', 'CANTON', 'FOOCHOW', 'HANKOW', 'KIUKIANG', 'PEKING', 'NINGPO', 'TAIWAN', 'AMOY', 'BUBBLING WELL', 'SEYMOUR', 'GORDON', 'FERRY', 'AVENUE ROAD', 'SINZA', 'CARTER', 'MARKHAM', 'MEDHURST', 'HART', 'KIAOCHOW', 'SHANHAIKWAN', 'BURKILL', 'YATES', 'MOHAWK', 'PARK ROAD', 'MYBURGH', 'LLOYD', 'KWANGSE', 'YUNNAN', 'KWEICHOW', 'MUSEUM ROAD', 'YUEN MING YUEN', 'SZECHUEN ROAD', 'JINKEE', 'EZRA', 'MACAO', 'ROBINSON', 'CONNAUGHT', 'PENANG', 'SINGAPORE', 'HAIG'],
    'Zhabei': ['CHAPEI', 'BOUNDARY ROAD', 'NORTH STATION', 'PAOSHAN', 'ALABASTER'],
    'Old City / Nanshi': ['NANTAO', 'FONGPANG', 'CHUNGHWA', 'MINKUO', 'MARCHAND', 'PORTE DE FER', 'LUMINA', 'CHINESE CITY', 'NATIVE CITY'],
    'Extra-Settlement Roads': ['GREAT WESTERN', 'JESSFIELD', 'BRENNAN', 'HUNGJAO', 'RUBICON', 'EDINBURGH', 'COLUMBIA', 'AMHERST', 'TUNSIN', 'KESWICK']
}

locale_dict = {k: [] for k in rules.keys()}
locale_dict['Unknown'] = []

for s in streets:
    assigned = False
    for loc, keywords in rules.items():
        if any(kw in s for kw in keywords):
            locale_dict[loc].append(s)
            assigned = True
            break
    if not assigned:
        locale_dict['Unknown'].append(s)

with open('public/data/locale_dictionary.json', 'w', encoding='utf-8') as f:
    json.dump(locale_dict, f, indent=2)

print(f"Categorized {len(streets)} streets.")
for loc, items in locale_dict.items():
    print(f"{loc}: {len(items)}")
