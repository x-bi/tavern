export type PageQuery = {
  page: number;
  pageSize: number;
};

export type PageResult<T> = PageQuery & {
  total: number;
  items: T[];
};
