import {
  FC,
  ReactElement,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useLocalContext } from '@graasp/apps-query-client';
import { PermissionLevel, PermissionLevelCompare } from '@graasp/sdk';

import { sortBy } from 'lodash';

import {
  AppDataType,
  UserInteractionAppData,
  getDefaultUserInteractionAppData,
} from '@/config/appData';
import { hooks, mutations } from '@/config/queryClient';
import { UserInteraction } from '@/interfaces/userInteraction';
import Interaction from '@/types/Interaction';

type UserInteractionsContextType = {
  userInteraction?: UserInteraction;
  setInteraction: (interaction: Interaction) => void;
  deleteInteraction: (id?: UserInteractionAppData['id']) => void;
  allInteractionsAppData?: UserInteractionAppData[];
  status: 'loading' | 'error' | 'success';
};

const defaultContextValue: UserInteractionsContextType = {
  setInteraction: () => null,
  deleteInteraction: () => null,
  status: 'loading',
};

const UserInteractionsContext =
  createContext<UserInteractionsContextType>(defaultContextValue);

export const UserInteractionsProvider: FC<{
  children: ReactElement | ReactElement[];
}> = ({ children }) => {
  const { data, isSuccess, status } = hooks.useAppData<UserInteraction>({
    type: AppDataType.UserInteraction,
  });

  const [userInteractionAppData, setUserInteractionAppData] =
    useState<UserInteractionAppData>();
  const [allInteractionsAppData, setAllInteractionsAppData] =
    useState<UserInteractionAppData[]>();

  const cachePayload = useRef<UserInteraction>();
  // const debouncedPatch = useRef<ReturnType<typeof debounce>>();
  const hasPosted = useRef<boolean>(false);
  const { mutate: postAppData } = mutations.usePostAppData();
  const { mutate: patchAppData } = mutations.usePatchAppData();
  const { mutate: deleteAppData } = mutations.useDeleteAppData();
  const { permission, memberId } = useLocalContext();

  const isAdmin = useMemo(
    () => PermissionLevelCompare.gte(permission, PermissionLevel.Admin),
    [permission],
  );
  useEffect(() => {
    if (isSuccess) {
      const allIns = data.filter(
        (d) => d.type === AppDataType.UserInteraction,
      ) as UserInteractionAppData[];
      setAllInteractionsAppData(allIns);
      setUserInteractionAppData(
        sortBy(allIns, ['createdAt'])
          .reverse()
          .find((d) => d.member.id === memberId),
      );
    }
  }, [isSuccess, data, memberId]);

  useEffect(() => {
    if (isSuccess && userInteractionAppData) {
      hasPosted.current = true;
    }
  });

  const setInteraction = useMemo(
    () =>
      (interaction: Interaction): void => {
        const payloadData = {
          interaction,
        };
        if (isSuccess) {
          if (hasPosted.current) {
            if (userInteractionAppData?.id) {
              // Eventually useless
              cachePayload.current = payloadData;
              patchAppData({
                ...userInteractionAppData,
                data: cachePayload.current,
              });
            }
          } else {
            postAppData(getDefaultUserInteractionAppData(payloadData));
            hasPosted.current = true;
          }
        }
      },
    [isSuccess, patchAppData, postAppData, userInteractionAppData],
  );

  const deleteInteraction = useMemo(
    () =>
      (id?: UserInteractionAppData['id']): void => {
        if (id) {
          deleteAppData({ id });
        } else if (userInteractionAppData) {
          deleteAppData({ id: userInteractionAppData?.id });
        }
        setUserInteractionAppData(undefined);
        hasPosted.current = false;
      },
    [deleteAppData, userInteractionAppData],
  );
  const contextValue = useMemo(
    () => ({
      userInteraction: userInteractionAppData?.data,
      setInteraction,
      allInteractionsAppData: isAdmin ? allInteractionsAppData : undefined,
      deleteInteraction,
      status,
    }),
    [
      allInteractionsAppData,
      deleteInteraction,
      isAdmin,
      setInteraction,
      status,
      userInteractionAppData?.data,
    ],
  );

  return (
    <UserInteractionsContext.Provider value={contextValue}>
      {children}
    </UserInteractionsContext.Provider>
  );
};

const useUserInteractions = (): UserInteractionsContextType =>
  useContext(UserInteractionsContext);

export default useUserInteractions;
