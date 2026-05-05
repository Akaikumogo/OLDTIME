import { memo, useMemo } from 'react';

interface Props {
  text: string;
  highlight?: string;
  className?: string;
}

const HighlightText = memo(({ text, highlight, className }: Props) => {
  const parts = useMemo(() => {
    if (!highlight?.trim()) return [{ text, match: false }];

    const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const segments = text.split(regex);

    return segments
      .filter(Boolean)
      .map((seg) => ({
        text: seg,
        match: regex.test(seg),
      }));
  }, [text, highlight]);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className="bg-yellow-300/80 dark:bg-yellow-500/40 text-inherit rounded-sm px-0.5"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  );
});

HighlightText.displayName = 'HighlightText';

export default HighlightText;
