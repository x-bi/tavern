import type { CurrentUser } from '../users/user.types';

export type ContentLibraryScope = 'owned' | 'library';

export type ContentLibraryAccess = {
  owner: CurrentUser;
  isOwner: boolean;
  ownerName: string | null;
};
