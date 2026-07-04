/** 世界书条目允许的插入位置（用于 DTO 校验和默认值归一化）。 */
export const WORLD_BOOK_ENTRY_INSERTION_ORDERS = [
  'before_history',
  'after_history',
  'before_current_user_input',
  'after_current_user_input'
] as const;
