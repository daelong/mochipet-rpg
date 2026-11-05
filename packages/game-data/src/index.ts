export type Effect = 'strike' | 'heal' | 'poison' | 'guard';
export interface Skill {
  id: string;
  name: string;
  description: string;
  power: number;
  cooldown: number;
  effect: Effect;
  requiredLevel: number;
  price: number;
  animation: 'spark' | 'leaf' | 'moon' | 'heart';
}
export interface Character {
  id: string;
  name: string;
  animal: string;
  group: 'zodiac' | 'mbti';
  mbti?: string;
  tagline: string;
  skillId: string;
  stats: { attack: number; defense: number; agility: number; hp: number };
}
const zodiac = [
  ['rat', '쥐', '재빠른 훔치기', '작아도 용감한 모험가'],
  ['ox', '소', '우직한 돌진', '언제나 든든한 친구'],
  ['tiger', '호랑이', '맹호 발톱', '용기만큼 커다란 마음'],
  ['rabbit', '토끼', '달빛 점프', '달빛을 따라 폴짝폴짝'],
  ['dragon', '용', '청룡 숨결', '구름 너머 꿈을 향해'],
  ['snake', '뱀', '그림자 독니', '조용하고 영리한 친구'],
  ['horse', '말', '질풍 돌파', '바람과 달리는 모험가'],
  ['sheep', '양', '포근한 응원', '몽글몽글 다정한 마음'],
  ['monkey', '원숭이', '장난 폭탄', '호기심 가득한 하루'],
  ['rooster', '닭', '새벽의 노래', '아침을 깨우는 목소리'],
  ['dog', '개', '충성 돌진', '네 곁을 지켜줄 친구'],
  ['pig', '돼지', '행운 꿀꺽', '행복을 찾는 작은 코'],
] as const;
const mbti = [
  ['INTJ', '부엉이', '전략의 일격'],
  ['INTP', '고양이', '탐구의 섬광'],
  ['ENTJ', '사자', '지휘 돌격'],
  ['ENTP', '여우', '기발한 폭발'],
  ['INFJ', '사슴', '꿈의 수호'],
  ['INFP', '토끼', '희망의 빛'],
  ['ENFJ', '강아지', '따뜻한 용기'],
  ['ENFP', '레서판다', '반짝 장난'],
  ['ISTJ', '비버', '튼튼한 일격'],
  ['ISFJ', '펭귄', '포근한 보호'],
  ['ESTJ', '시바견', '대장의 돌진'],
  ['ESFJ', '곰', '우정의 응원'],
  ['ISTP', '수달', '정밀 타격'],
  ['ISFP', '물범', '고요한 바람'],
  ['ESTP', '호랑이', '질주 공격'],
  ['ESFP', '오리', '신나는 한방'],
] as const;
export const CHARACTERS: readonly Character[] = [
  ...zodiac.map(([id, name, , tagline], i) => ({
    id: `z_${id}`,
    name,
    animal: name,
    group: 'zodiac' as const,
    tagline,
    skillId: `skill_z_${id}`,
    stats: {
      attack: 7 + (i % 3),
      defense: 2 + (i % 2),
      agility: 1 + (i % 3),
      hp: 60 + (i % 3) * 4,
    },
  })),
  ...mbti.map(([type, animal], i) => ({
    id: `m_${type}`,
    name: `${type} ${animal}`,
    animal,
    mbti: type,
    group: 'mbti' as const,
    tagline: `${type} 테마의 작은 친구`,
    skillId: `skill_m_${type}`,
    stats: {
      attack: 7 + (i % 3),
      defense: 2 + (i % 2),
      agility: 1 + (i % 3),
      hp: 60 + (i % 3) * 4,
    },
  })),
];
export const SKILLS: readonly Skill[] = [
  ...zodiac.map(([id, , name], i) => ({
    id: `skill_z_${id}`,
    name,
    description:
      i === 7
        ? '응원으로 HP를 회복해요.'
        : i === 5
          ? '독니 공격 후 3번의 중독 피해를 줘요.'
          : i === 1
            ? '공격하고 잠시 피해를 줄여요.'
            : '힘을 모아 특별한 일격을 날려요.',
    power: i === 7 ? 12 : 15 + (i % 4) * 2,
    cooldown: 6 + (i % 3),
    effect: (i === 7 ? 'heal' : i === 5 ? 'poison' : i === 1 ? 'guard' : 'strike') as Effect,
    requiredLevel: 1,
    price: 0,
    animation: (i === 3 ? 'moon' : i === 7 ? 'heart' : 'spark') as Skill['animation'],
  })),
  ...mbti.map(([type, , name], i) => ({
    id: `skill_m_${type}`,
    name,
    description:
      i === 6 || i === 11 ? '따뜻한 마음으로 HP를 회복해요.' : '반짝이는 고유 스킬로 공격해요.',
    power: 16 + (i % 4) * 2,
    cooldown: 6 + (i % 3),
    effect: (i === 6 || i === 11 ? 'heal' : 'strike') as Effect,
    requiredLevel: 1,
    price: 0,
    animation: (i === 6 || i === 11 ? 'heart' : 'leaf') as Skill['animation'],
  })),
];
export interface Monster {
  id: string;
  name: string;
  hp: number;
  attack: number;
  xp: number;
  coins: number;
}
export const MONSTERS: readonly Monster[] = [
  { id: 'slime', name: '말랑 슬라임', hp: 28, attack: 4, xp: 14, coins: 9 },
  { id: 'mushroom', name: '숲속 버섯', hp: 36, attack: 5, xp: 18, coins: 12 },
  { id: 'bat', name: '꼬마 박쥐', hp: 60, attack: 8, xp: 27, coins: 18 },
  { id: 'foxfire', name: '반짝 여우불', hp: 70, attack: 9, xp: 32, coins: 21 },
  { id: 'golem', name: '이끼 골렘', hp: 110, attack: 13, xp: 45, coins: 29 },
  { id: 'shade', name: '동굴 그림자', hp: 95, attack: 12, xp: 40, coins: 27 },
  { id: 'ghost', name: '달빛 유령', hp: 165, attack: 17, xp: 65, coins: 40 },
  { id: 'moon', name: '그림자 달', hp: 185, attack: 19, xp: 75, coins: 46 },
];
export const ZONES = [
  {
    id: 'meadow',
    name: '풀잎 초원',
    level: 1,
    subtitle: '산들바람과 함께 시작하는 모험',
    monsters: ['slime', 'mushroom'],
    color: '#e9f1dc',
    emoji: '🌱',
  },
  {
    id: 'forest',
    name: '반짝 숲',
    level: 3,
    subtitle: '나뭇잎 사이로 반짝이는 비밀',
    monsters: ['bat', 'foxfire'],
    color: '#dcece0',
    emoji: '🌳',
  },
  {
    id: 'cave',
    name: '바위 동굴',
    level: 5,
    subtitle: '돌 틈에 숨겨진 작은 보물',
    monsters: ['golem', 'shade'],
    color: '#e7e4f0',
    emoji: '🪨',
  },
  {
    id: 'moonhill',
    name: '달빛 언덕',
    level: 8,
    subtitle: '은빛 달을 따라 걷는 밤',
    monsters: ['ghost', 'moon'],
    color: '#e2e6f4',
    emoji: '🌙',
  },
] as const;
export interface ShopItem {
  id: string;
  name: string;
  category: 'food' | 'toy' | 'training' | 'skill';
  description: string;
  price: number;
  level: number;
  limit: number;
  icon: string;
  effect: 'food' | 'heal' | 'toy' | 'attack' | 'defense' | 'agility' | 'maxHp' | 'skill';
  amount: number;
}
export const SHOP: readonly ShopItem[] = [
  {
    id: 'rice',
    name: '따끈한 주먹밥',
    category: 'food',
    description: '배부름 +30 · 체력 +10',
    price: 15,
    level: 1,
    limit: 0,
    icon: '🍙',
    effect: 'food',
    amount: 30,
  },
  {
    id: 'berry',
    name: '달콤한 회복 베리',
    category: 'food',
    description: 'HP +35',
    price: 20,
    level: 1,
    limit: 0,
    icon: '🫐',
    effect: 'heal',
    amount: 35,
  },
  {
    id: 'ball',
    name: '알록달록 공',
    category: 'toy',
    description: '행복 +25 · 친밀도 +5',
    price: 35,
    level: 1,
    limit: 99,
    icon: '🧶',
    effect: 'toy',
    amount: 25,
  },
  {
    id: 'attack',
    name: '작은 용기 훈련',
    category: 'training',
    description: '공격력 +2',
    price: 65,
    level: 1,
    limit: 50,
    icon: '⚔️',
    effect: 'attack',
    amount: 2,
  },
  {
    id: 'defense',
    name: '든든한 마음 훈련',
    category: 'training',
    description: '방어력 +1',
    price: 60,
    level: 1,
    limit: 50,
    icon: '🛡️',
    effect: 'defense',
    amount: 1,
  },
  {
    id: 'agility',
    name: '가벼운 발걸음',
    category: 'training',
    description: '민첩성 +1',
    price: 70,
    level: 2,
    limit: 19,
    icon: '🍃',
    effect: 'agility',
    amount: 1,
  },
  {
    id: 'max-hp',
    name: '건강한 하루',
    category: 'training',
    description: '최대 HP +8',
    price: 80,
    level: 2,
    limit: 25,
    icon: '💗',
    effect: 'maxHp',
    amount: 8,
  },
  {
    id: 'skill',
    name: '반짝 스킬 강화',
    category: 'skill',
    description: '고유 스킬 위력 +3',
    price: 100,
    level: 3,
    limit: 20,
    icon: '✨',
    effect: 'skill',
    amount: 1,
  },
];
export const characterById = (id: string) => CHARACTERS.find((c) => c.id === id);
export const skillById = (id: string) => SKILLS.find((s) => s.id === id);
export const monsterById = (id: string) => MONSTERS.find((m) => m.id === id)!;
export const petAsset = (id: string, action = 'idle', frame = 0) =>
  `/game-assets/pets/${characterById(id)?.id ?? 'z_rabbit'}/${action}_${frame}_right.png`;
