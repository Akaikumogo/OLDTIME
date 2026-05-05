import { useQuery, type QueryKey } from '@tanstack/react-query';

interface UseFetchReturn<T> {
  data: T;
  loading: boolean;
  initialLoading: boolean;
  refetch: () => void;
}

export function useFetch<T>(
  key: QueryKey,
  fetcher: () => Promise<T>,
  initial: T,
): UseFetchReturn<T> {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: key,
    queryFn: fetcher,
  });

  return {
    data: data ?? initial,
    loading: isFetching,
    initialLoading: isLoading,
    refetch,
  };
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
}

interface UsePaginatedFetchReturn<T> {
  data: T[];
  total: number;
  loading: boolean;
  initialLoading: boolean;
  refetch: () => void;
}

export function usePaginatedFetch<T>(
  key: QueryKey,
  fetcher: () => Promise<PaginatedResult<T>>,
): UsePaginatedFetchReturn<T> {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: key,
    queryFn: fetcher,
  });

  return {
    data: data?.data ?? [],
    total: data?.total ?? 0,
    loading: isFetching,
    initialLoading: isLoading,
    refetch,
  };
}
