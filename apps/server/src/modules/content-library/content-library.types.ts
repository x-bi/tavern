import type { CurrentUser } from '../users/user.types';

export type ContentLibraryScope = 'owned' | 'library' | 'managed';

export type ContentLibraryAccess = {
  owner: CurrentUser | null;
  isOwner: boolean;
  ownerName: string | null;
  isManaged: boolean;
};
