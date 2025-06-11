import { Box } from '@mui/material';

import { PLAYER_VIEW_CY } from '@/config/selectors';
import ParticipantInteraction from '@/modules/interaction/ParticipantInteraction';

const PlayerView = (): JSX.Element => (
  <Box data-cy={PLAYER_VIEW_CY}>
    <ParticipantInteraction />
  </Box>
);
export default PlayerView;
