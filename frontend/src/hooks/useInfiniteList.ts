import { useCallback } from 'react';
import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';

interface PaginatedResult<T> {
  data: T[];
  total: number;
}

interface UseInfiniteListReturn<T> {
  data: T[];
  total: number;
  loading: boolean;
  initialLoading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
}

export function useInfiniteList<T>(
  key: QueryKey,
  fetcher: (page: number) => Promise<PaginatedResult<T>>,
): UseInfiniteListReturn<T> {
  const {
    data: raw,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetcher(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.data.length, 0);
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
  });

  const allItems = raw?.pages.flatMap((p) => p.data) ?? [];
  const total = raw?.pages[0]?.total ?? 0;

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    data: allItems,
    total,
    loading: isFetching && !isFetchingNextPage,
    initialLoading: isLoading,
    loadingMore: isFetchingNextPage,
    hasMore: !!hasNextPage,
    loadMore,
    refetch,
  };
}
