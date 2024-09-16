import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { UseTranslationResponse, useTranslation } from 'react-i18next';

import { Button } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { AppContext, useLocalContext } from '@graasp/apps-query-client';
import { Member } from '@graasp/sdk';

import { UseQueryResult } from '@tanstack/react-query';

import {
  defaultAssistant,
  defaultExchange,
  defaultInteraction,
  defaultUser,
} from '@/config/config';
import { hooks } from '@/config/queryClient';
import { START_INTERACTION_BUTTON_CY } from '@/config/selectors';
import MessagesPane from '@/modules/message/MessagesPane';
import Agent from '@/types/Agent';
import AgentType from '@/types/AgentType';
import Exchange from '@/types/Exchange';
import Interaction from '@/types/Interaction';

import { SettingsContextType, useSettings } from '../context/SettingsContext';
import useUserInteractions from '../context/UserInteractionsContext';

// Main component: ParticipantInteraction
const ParticipantInteraction = (): ReactElement => {
  const { t }: UseTranslationResponse<'translations', undefined> =
    useTranslation();

  // Getting the participant ID from local context
  const { memberId } = useLocalContext();

  // Fetching settings context
  const { chat, exchanges }: SettingsContextType = useSettings();

  const { userInteraction, setInteraction: setSavedInteraction } =
    useUserInteractions();

  // Fetching app member context
  const {
    data: appContextData,
    isSuccess,
  }: UseQueryResult<AppContext, unknown> = hooks.useAppContext();

  // Find the member in app context data by participant ID
  const appMember: Member | undefined = useMemo(
    () =>
      appContextData?.members.find(
        (member) => member.id === memberId && memberId.length > 0,
      ),
    [appContextData, memberId],
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

  // State to manage the current interaction, either from existing data or a new template
  const [interaction, setInteraction] =
    useState<Interaction>(defaultInteraction);
  const [isInit, setIsInit] = useState<boolean>(false);

  // Update the interaction if the stored value change
  useEffect(() => {
    if (!isInit && typeof userInteraction !== undefined && isSuccess) {
      setInteraction(
        userInteraction?.interaction ?? createInteractionFromTemplate(),
      );
      setIsInit(true);
    }
  }, [
    createInteractionFromTemplate,
    interaction.started,
    isInit,
    isSuccess,
    setInteraction,
    userInteraction,
  ]);

  useEffect((): void => {
    if (appMember) {
      setSavedInteraction(interaction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMember, interaction]);

  // Callback to update a specific exchange within the interaction
  const updateExchange = useCallback((updatedExchange: Exchange): void => {
    setInteraction(
      (prevState: Interaction): Interaction => ({
        ...(prevState || defaultInteraction),
        exchanges: {
          exchangeList: prevState.exchanges.exchangeList.map((exchange) =>
            exchange.id === updatedExchange.id ? updatedExchange : exchange,
          ),
        },
        updatedAt: new Date(),
      }),
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
    setInteraction(
      (prev: Interaction): Interaction => ({
        ...(prev || defaultInteraction),
        started: true,
        startedAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  };

  // Function to move to the next exchange or complete the interaction
  const goToNextExchange = (): void => {
    setInteraction((prev: Interaction): Interaction => {
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
    });
  };

  // Render fallback if interaction data is not available
  if (!interaction) {
    return <div>Interaction Not Found</div>;
  }

  // Handle the start of the interaction
  const handleStartInteraction = (): void => {
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
