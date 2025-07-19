import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

const PMSPage = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        PMS Integration
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1">
            Property Management System integration - configure Opera PMS connection, 
            view guest information, manage synchronization, and monitor integration status.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Features: PMS configuration, guest data sync, manual triggers, connection monitoring
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PMSPage;
