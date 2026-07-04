/** 分页查询入参（页码从 1 开始，pageSize 为每页条数）。 */
export type PageQuery = {
  /** 页码，从 1 开始。 */
  page: number;
  /** 每页条数。 */
  pageSize: number;
};

/**
 * 分页查询结果，在 PageQuery 基础上附带总数与当前页数据。
 * @property total 符合查询条件的总条数。
 * @property items 当前页的数据项。
 */
export type PageResult<T> = PageQuery & {
  total: number;
  items: T[];
};
