import { useEffect, useState } from 'react';

import { Box } from '@mui/material';

import { PLAYER_VIEW_CY } from '@/config/selectors';
import ParticipantInteraction from '@/modules/interaction/ParticipantInteraction';

const PlayerView = (): JSX.Element => {
  const [height, setHeight] = useState<number | null>(null);
  const HEADER_HEIGHT = 64;
  const PADDING = 24;
  const space = window.parent ? HEADER_HEIGHT + PADDING : 0;

  useEffect(() => {
    const updateHeight = (): void => {
      const parentHeight = window.parent?.innerHeight || window.innerHeight;
      setHeight(parentHeight - space);
    };

    updateHeight(); // initial
    window.addEventListener('resize', updateHeight);

    return () => window.removeEventListener('resize', updateHeight);
  }, [space]);

  return (
    <Box
      data-cy={PLAYER_VIEW_CY}
      sx={{ height: height ? `${height}px` : 'auto' }}
    >
      <ParticipantInteraction />
    </Box>
  );
};

export default PlayerView;
