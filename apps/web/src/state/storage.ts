import { defaults, parsePet, SCHEMA_VERSION, type Pet } from '@mochi/shared';
export const SAVE_KEY = 'mochipet.web.v1';
export const BACKUP_KEY = `${SAVE_KEY}.previous`;
export const RESET_KEY = `${SAVE_KEY}.before-reset`;
export const HOME_UPGRADE_KEY = `${SAVE_KEY}.before-home-upgrade`;
const DAMAGED_KEY = `${SAVE_KEY}.damaged`;
const LIMIT = 65536;
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface LoadResult {
  pet: Pet;
  readOnly: boolean;
  message: string;
}
function decode(text: string): Pet {
  if (text.length > LIMIT) throw new Error('Too large');
  return parsePet(JSON.parse(text));
}
function future(text: string) {
  try {
    const raw = JSON.parse(text);
    return typeof raw?.schema === 'number' && raw.schema > SCHEMA_VERSION;
  } catch {
    return false;
  }
}
export class SaveRepository {
  constructor(private storage: StoragePort) {}
  load(): LoadResult {
    try {
      const main = this.storage.getItem(SAVE_KEY);
      if (main === null) {
        const previous = this.storage.getItem(BACKUP_KEY);
        if (previous)
          return {
            pet: decode(previous),
            readOnly: false,
            message: '이전 저장에서 친구를 데려왔어요.',
          };
        return { pet: defaults(), readOnly: false, message: '' };
      }
      if (main.length <= LIMIT && future(main))
        return {
          pet: defaults(),
          readOnly: true,
          message: '더 새로운 버전의 기록이에요. 덮어쓰지 않도록 읽기 전용으로 열었어요.',
        };
      try {
        return { pet: decode(main), readOnly: false, message: '' };
      } catch {
        const previous = this.storage.getItem(BACKUP_KEY);
        if (previous && main.length <= LIMIT) {
          const pet = decode(previous);
          this.storage.setItem(DAMAGED_KEY, main);
          return {
            pet,
            readOnly: false,
            message: '현재 저장이 손상되어 이전 정상 기록을 복구했어요.',
          };
        }
        return {
          pet: defaults(),
          readOnly: true,
          message:
            '저장을 읽을 수 없어요. 원본을 보호하기 위해 읽기 전용으로 열었어요. 설정에서 백업 후 초기화할 수 있어요.',
        };
      }
    } catch {
      return {
        pet: defaults(),
        readOnly: true,
        message: '브라우저 저장소에 접근할 수 없어요. 저장 권한과 여유 공간을 확인해 주세요.',
      };
    }
  }
  save(pet: Pet) {
    const current = this.storage.getItem(SAVE_KEY);
    if (current && current.length <= LIMIT && future(current))
      throw new Error('Future save is protected');
    const clean = parsePet({ ...pet, savedAt: Date.now() });
    const next = JSON.stringify(clean);
    if (current) {
      let valid = false;
      try {
        decode(current);
        valid = true;
      } catch {
        // Recovery already preserved the damaged primary; keep its good backup.
      }
      if (valid) {
        if (JSON.parse(current).schema === 1 && this.storage.getItem(HOME_UPGRADE_KEY) === null) {
          this.storage.setItem(HOME_UPGRADE_KEY, current);
          if (this.storage.getItem(HOME_UPGRADE_KEY) !== current)
            throw new Error('Upgrade backup verification failed');
        }
        this.storage.setItem(BACKUP_KEY, current);
      }
    }
    this.storage.setItem(SAVE_KEY, next);
    if (this.storage.getItem(SAVE_KEY) !== next) throw new Error('Save verification failed');
  }
  reset() {
    const main = this.storage.getItem(SAVE_KEY);
    const previous = this.storage.getItem(BACKUP_KEY);
    const before = JSON.stringify({ main, previous });
    this.storage.setItem(RESET_KEY, before);
    if (this.storage.getItem(RESET_KEY) !== before) throw new Error('Reset backup failed');
    const fresh = defaults();
    const encoded = JSON.stringify(fresh);
    this.storage.setItem(SAVE_KEY, encoded);
    this.storage.setItem(BACKUP_KEY, encoded);
    return fresh;
  }
}
