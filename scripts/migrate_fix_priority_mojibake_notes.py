import json
import shutil
from datetime import datetime
from pathlib import Path

DB = Path('api/db.json')

REPLACEMENTS = {
    '\ufffd\ufffdnh d?u uu ti\ufffdn': 'Đánh dấu ưu tiên',
    'Ðánh d?u uu tiên': 'Đánh dấu ưu tiên',
    'Ðánh dấu uu tiên': 'Đánh dấu ưu tiên',
    'Dánh d?u uu tiên': 'Đánh dấu ưu tiên',
    'Danh dau uu tien': 'Đánh dấu ưu tiên',
    'B? uu ti\ufffdn': 'Bỏ ưu tiên',
    'B? uu tiên': 'Bỏ ưu tiên',
    'Bo uu tien': 'Bỏ ưu tiên',
}

def fix_text(value):
    if not isinstance(value, str):
        return value, 0
    hits = 0
    out = value
    for old, new in REPLACEMENTS.items():
        if old in out:
            hits += out.count(old)
            out = out.replace(old, new)
    return out, hits

def main():
    data = json.loads(DB.read_text(encoding='utf-8'))
    updated_notes = 0
    hits = 0

    for warranty in data.get('warranties', []):
        for history in warranty.get('history', []) or []:
            fixed, count = fix_text(history.get('note'))
            if count:
                history['note'] = fixed
                updated_notes += 1
                hits += count

    if not hits:
        print('No priority mojibake notes found.')
        return

    backup = DB.with_suffix(DB.suffix + '.bak.priority-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
    shutil.copy2(DB, backup)
    DB.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Backup: {backup}')
    print(f'Updated notes: {updated_notes}')
    print(f'Replacement hits: {hits}')

if __name__ == '__main__':
    main()
