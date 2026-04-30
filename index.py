# index.py
import json
import os
from datetime import datetime

MANUAL_NUMBERS_FILE = "manual_numbers.json"

def load_numbers():
    if not os.path.exists(MANUAL_NUMBERS_FILE):
        default = {"numbers": []}
        save_numbers(default)
        return default
    with open(MANUAL_NUMBERS_FILE, 'r') as f:
        return json.load(f)

def save_numbers(data):
    with open(MANUAL_NUMBERS_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def get_available_number(country, service):
    data = load_numbers()
    for num in data['numbers']:
        if num['country'] == country and num['service'] == service and num['status'] == 'available':
            return num
    return None

def reserve_number(phone, tg_id):
    data = load_numbers()
    for num in data['numbers']:
        if num['phone'] == phone and num['status'] == 'available':
            num['status'] = 'reserved'
            num['used_by'] = tg_id
            num['used_at'] = datetime.now().isoformat()
            save_numbers(data)
            return True
    return False

def release_number(phone):
    data = load_numbers()
    for num in data['numbers']:
        if num['phone'] == phone:
            num['status'] = 'available'
            num['used_by'] = None
            num['used_at'] = None
            save_numbers(data)
            return True
    return False

def add_number(phone, country, service):
    data = load_numbers()
    for num in data['numbers']:
        if num['phone'] == phone:
            return False, "Number exists"
    new_id = max([n['id'] for n in data['numbers']] + [0]) + 1
    data['numbers'].append({
        "id": new_id,
        "phone": phone,
        "country": country.upper(),
        "service": service.lower(),
        "status": "available",
        "used_by": None,
        "used_at": None
    })
    save_numbers(data)
    return True, f"Added (ID: {new_id})"

def remove_number(phone):
    data = load_numbers()
    for i, num in enumerate(data['numbers']):
        if num['phone'] == phone:
            data['numbers'].pop(i)
            save_numbers(data)
            return True, "Removed"
    return False, "Not found"

def list_numbers():
    data = load_numbers()
    if not data['numbers']:
        return "📭 No numbers"
    result = "📋 NUMBERS:\n"
    for num in data['numbers']:
        status = "✅" if num['status'] == 'available' else "🔴"
        result += f"{status} {num['phone']} | {num['service']} | {num['country']}\n"
    return result