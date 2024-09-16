import { AppData, AppDataVisibility } from '@graasp/sdk';

import { UserInteraction as UserInteractionType } from '@/interfaces/userInteraction';

export enum AppDataType {
  UserInteraction = 'user-interaction',
}

export type UserInteractionAppData = AppData & {
  type: AppDataType.UserInteraction;
  data: UserInteractionType;
  visibility: AppDataVisibility.Member;
};

export const getDefaultUserInteractionAppData = (
  userInteraction: UserInteractionType,
): Pick<UserInteractionAppData, 'data' | 'type' | 'visibility'> => ({
  type: AppDataType.UserInteraction,
  data: userInteraction,
  visibility: AppDataVisibility.Member,
});
