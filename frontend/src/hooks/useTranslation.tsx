import { useApp } from '../Providers/Configuration';
import { latinTextToCyrillic } from '@/utils/latinToCyrillic';

export const useTranslation = () => {
  const { lang, setLang } = useApp();

  const t = (dict: Partial<Record<'uz' | 'ru' | 'en', string>>) => {
    if (lang === 'uz-cyrl') {
      const latinText = dict.uz ?? '[No translation]';
      return latinTextToCyrillic(latinText);
    }

    return dict[lang] ?? dict.uz ?? '[No translation]';
  };

  return { t, lang, setLang };
};
