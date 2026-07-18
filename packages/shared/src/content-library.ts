export type ContentLibraryScope = 'owned' | 'library' | 'managed';

export type ContentLibraryFields = {
  isShared: boolean;
  isOwner: boolean;
  ownerName: string | null;
  canFork: boolean;
};
