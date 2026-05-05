const letterMap: Record<string, string> = {
  a: 'а',
  b: 'б',
  d: 'д',
  e: 'е',
  f: 'ф',
  g: 'г',
  h: 'ҳ',
  i: 'и',
  j: 'ж',
  k: 'к',
  l: 'л',
  m: 'м',
  n: 'н',
  o: 'о',
  p: 'п',
  q: 'қ',
  r: 'р',
  s: 'с',
  t: 'т',
  u: 'у',
  v: 'в',
  x: 'х',
  y: 'й',
  z: 'з'
};

const digraphs: Array<[RegExp, string]> = [
  [/o['`‘’ʼʻ]?\b/gi, 'ў'],
  [/g['`‘’ʼʻ]/gi, 'ғ'],
  [/sh/gi, 'ш'],
  [/ch/gi, 'ч'],
  [/yo/gi, 'ё'],
  [/yu/gi, 'ю'],
  [/ya/gi, 'я'],
  [/ye/gi, 'е'],
  [/ts/gi, 'ц']
];

const preserveCase = (source: string, target: string) => {
  if (source.toUpperCase() === source) return target.toUpperCase();
  if (source[0] && source[0].toUpperCase() === source[0]) {
    return target[0].toUpperCase() + target.slice(1);
  }
  return target;
};

export const latinTextToCyrillic = (text: string): string => {
  let out = text;

  digraphs.forEach(([matcher, value]) => {
    out = out.replace(matcher, (m) => preserveCase(m, value));
  });

  out = out.replace(/[A-Za-z]/g, (char) => {
    const mapped = letterMap[char.toLowerCase()];
    if (!mapped) return char;
    return preserveCase(char, mapped);
  });

  return out;
};
