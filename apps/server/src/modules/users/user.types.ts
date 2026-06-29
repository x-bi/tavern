export type CurrentUser = {
  id: string;
  username: string;
  displayName: string;
  mode: 'single_user';
};

export type UserRecord = {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string | null;
  isActive: boolean;
};
