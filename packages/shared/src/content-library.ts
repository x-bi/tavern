export type ContentLibraryScope = 'owned' | 'library';

export type ContentLibraryFields = {
  isShared: boolean;
  isOwner: boolean;
  ownerName: string | null;
  canFork: boolean;
};
