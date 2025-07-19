import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

const AppsPage = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Apps Library
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1">
            App management interface - manage applications available on TV devices, 
            including icons, store URLs, and assignment to specific rooms or devices.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Features: App creation, icon upload, bulk assignment, installation triggers
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AppsPage;
