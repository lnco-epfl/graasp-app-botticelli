import {
  Dispatch,
  MutableRefObject,
  ReactElement,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { UseTranslationResponse, useTranslation } from 'react-i18next';

import { Button } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import {
  AppContext,
  LocalContext,
  useLocalContext,
} from '@graasp/apps-query-client';
import { Member } from '@graasp/sdk';

import { UseQueryResult } from '@tanstack/react-query';

import {
  defaultAssistant,
  defaultExchange,
  defaultInteraction,
  defaultUser,
} from '@/config/config';
import { hooks, mutations } from '@/config/queryClient';
import { START_INTERACTION_BUTTON_CY } from '@/config/selectors';
import { useFullscreen } from '@/hooks/useFullscreen';
import MessagesPane from '@/modules/message/MessagesPane';
import Agent from '@/types/Agent';
import AgentType from '@/types/AgentType';
import Exchange from '@/types/Exchange';
import Interaction from '@/types/Interaction';

import { SettingsContextType, useSettings } from '../context/SettingsContext';

// Main component: ParticipantInteraction
const ParticipantInteraction = (): ReactElement => {
  // Getting the participant ID from local context
  const { memberId: participantId }: LocalContext = useLocalContext();

  // Fetching application data for interactions
  const { data: appDataList, isLoading: appDataLoading } =
    hooks.useAppData<Interaction>();
  const { mutate: postAppData } = mutations.usePostAppData();
  const { mutate: patchAppData } = mutations.usePatchAppData();

  // Fetching settings context
  const { chat, exchanges }: SettingsContextType = useSettings();
  const { t }: UseTranslationResponse<'translations', undefined> =
    useTranslation();

  // Fetching app member context
  const { data: appContextData }: UseQueryResult<AppContext, unknown> =
    hooks.useAppContext();

  const { toggleFullscreen } = useFullscreen();

  // Find the member in app context data by participant ID
  const appMember: Member | undefined = useMemo(
    () => appContextData?.members.find((member) => member.id === participantId),
    [appContextData, participantId],
  );

  // Define the current member as an agent, merging with the default user
  const currentMember: Agent = useMemo(
    (): Agent => ({
      ...defaultUser,
      ...(appMember?.id ? { id: appMember.id } : {}),
      ...(appMember?.name ? { name: appMember.name } : {}),
    }),
    [appMember?.id, appMember?.name],
  );

  /**
   * @function createInteractionFromTemplate
   * @description Creates and returns a new `Interaction` object by merging default settings with chat and exchange settings.
   * @returns {Interaction} A fully constructed `Interaction` object with merged settings.
   */
  const createInteractionFromTemplate: () => Interaction =
    useCallback((): Interaction => {
      const interactionBase: Interaction = {
        ...defaultInteraction,
        ...chat,
        participant: currentMember,
      };
      interactionBase.exchanges.exchangeList = exchanges.exchangeList.map(
        (exchange) => ({
          ...defaultExchange,
          ...exchange,
          assistant: {
            ...defaultAssistant,
            ...exchange.assistant,
            type: AgentType.Assistant,
          },
        }),
      );
      return interactionBase;
    }, [chat, currentMember, exchanges.exchangeList]);

  // Memoize the current app data for the participant
  const currentAppData = useMemo(
    () =>
      appDataList
        ?.filter((appData) => appData.type === 'Interaction')
        .find((appData) => appData.data.participant.id === participantId),
    [appDataList, participantId],
  );

  // State to manage the current interaction, either from existing data or a new template
  const [interaction, setInteraction]: [
    Interaction | undefined,
    Dispatch<SetStateAction<Interaction | undefined>>,
  ] = useState<Interaction | undefined>(undefined);

  useEffect((): void => {
    if (!appDataLoading && appContextData && appMember) {
      setInteraction(currentAppData?.data || createInteractionFromTemplate());
    }
  }, [
    appDataLoading,
    appContextData,
    appMember,
    createInteractionFromTemplate,
    currentAppData?.data,
  ]);

  // Ref to track if the app data has already been posted
  const hasPosted: MutableRefObject<boolean> = useRef(!!currentAppData);

  useEffect(() => {
    if (currentAppData) {
      // Set hasPosted to true when currentAppData is available
      hasPosted.current = true;
    }
  }, [currentAppData]);

  // Effect to post the interaction data if it hasn't been posted yet
  useEffect((): void => {
    if (!appDataLoading && !hasPosted.current && interaction) {
      postAppData({ data: interaction, type: 'Interaction' });
      hasPosted.current = true;
    }
  }, [appDataLoading, interaction, postAppData]);

  // Effect to patch the interaction data if it has been posted and current app data exists
  useEffect((): void => {
    if (hasPosted.current && currentAppData?.id && interaction) {
      patchAppData({
        id: currentAppData.id,
        data: interaction,
      });
    }
  }, [interaction, patchAppData, currentAppData?.id]);

  // Callback to update a specific exchange within the interaction
  const updateExchange = useCallback((updatedExchange: Exchange): void => {
    setInteraction(
      (prevState: Interaction | undefined): Interaction | undefined => {
        if (prevState) {
          return {
            ...(prevState || defaultInteraction),
            exchanges: {
              exchangeList: prevState.exchanges.exchangeList.map((exchange) =>
                exchange.id === updatedExchange.id ? updatedExchange : exchange,
              ),
            },
            updatedAt: new Date(),
          };
        }
        return undefined;
      },
    );
  }, []);

  // Effect to handle actions when the user tries to leave the page (before unload)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent): string => {
      if (!interaction?.completed) {
        event.preventDefault();
        const confirmationMessage = 'Are you sure you want to leave?';
        // eslint-disable-next-line no-param-reassign
        event.returnValue = confirmationMessage; // For Chrome
        return confirmationMessage; // For standard browsers
      }
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [interaction?.completed]);

  // Function to start the interaction
  const startInteraction = (): void => {
    setInteraction((prev: Interaction | undefined): Interaction | undefined => {
      if (prev) {
        return {
          ...(prev || defaultInteraction),
          started: true,
          startedAt: new Date(),
          updatedAt: new Date(),
        };
      }
      return undefined;
    });
  };

  // Function to move to the next exchange or complete the interaction
  const goToNextExchange = (): void => {
    setInteraction((prev: Interaction | undefined): Interaction | undefined => {
      if (prev) {
        const numExchanges: number = prev.exchanges.exchangeList.length || 0;
        if (prev.currentExchange === numExchanges - 1) {
          // If this is the last exchange, mark the interaction as completed
          return {
            ...prev,
            completed: true,
            completedAt: new Date(),
            updatedAt: new Date(),
          };
        }
        return {
          ...prev,
          currentExchange: (prev?.currentExchange || 0) + 1,
          updatedAt: new Date(),
        };
      }
      return undefined;
    });
  };

  // Render fallback if interaction data is not available
  if (!interaction) {
    return <div>Interaction Not Found</div>;
  }

  // Handle the start of the interaction
  const handleStartInteraction = (): void => {
    toggleFullscreen();
    startInteraction();
  };

  // Render the start interaction button if the interaction has not started
  if (!interaction.started) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'center',
        }}
      >
        {interaction.participantInstructions && (
          <Typography variant="body1" sx={{ p: 2, pt: 4, textAlign: 'center' }}>
            {interaction.participantInstructions}
          </Typography>
        )}
        <Button
          variant="contained"
          size="large"
          sx={{ mt: 3, mx: 'auto' }}
          onClick={handleStartInteraction}
          data-cy={START_INTERACTION_BUTTON_CY}
        >
          {t('START')}
        </Button>
      </Box>
    );
  }

  // Render the completed interaction message if the interaction is completed
  if (interaction.completed) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'center',
        }}
      >
        <Typography variant="body1" sx={{ p: 10, textAlign: 'center' }}>
          {interaction.participantEndText}
        </Typography>
      </Box>
    );
  }

  // Render the MessagesPane component to handle the conversation
  return (
    <MessagesPane
      goToNextExchange={goToNextExchange}
      autoDismiss={
        interaction.exchanges.exchangeList[interaction.currentExchange]
          ?.hardLimit
      }
      currentExchange={
        interaction.exchanges.exchangeList[interaction.currentExchange]
      }
      setExchange={updateExchange}
      interactionDescription={interaction.description}
      pastMessages={interaction.exchanges.exchangeList.flatMap((exchange) =>
        exchange.dismissed ? exchange.messages : [],
      )}
      participant={currentMember}
      sendAllMessages={interaction.sendAllToChatbot}
    />
  );
};

// Export the ParticipantInteraction component as the default export
export default ParticipantInteraction;
