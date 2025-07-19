import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

const DevicesPage = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Devices Management
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1">
            Device management interface - shows all connected Android TV boxes, 
            allows approval of new devices, room assignment, and remote control.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Features: Device approval, room assignment, bulk actions, device monitoring
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DevicesPage;
