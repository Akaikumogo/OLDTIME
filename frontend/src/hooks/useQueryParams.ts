import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useQueryParams<T extends Record<string, string | undefined>>(
  defaults: T,
) {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = {} as { [K in keyof T]: string | undefined };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    params[key] = searchParams.get(key as string) || defaults[key];
  }

  const setParam = useCallback(
    (key: keyof T, value: string | undefined) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!value || value === defaults[key]) {
            next.delete(key as string);
          } else {
            next.set(key as string, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, defaults],
  );

  const setParams = useCallback(
    (updates: Partial<{ [K in keyof T]: string | undefined }>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            if (!value || value === (defaults as Record<string, string | undefined>)[key]) {
              next.delete(key);
            } else {
              next.set(key, value);
            }
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, defaults],
  );

  return { params, setParam, setParams };
}
