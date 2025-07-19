import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

const SettingsPage = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        System Settings
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1">
            System configuration interface - manage panel branding, PMS integration, 
            user accounts, and guest message templates.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Features: Branding setup, admin management, PMS configuration, message templates
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SettingsPage;
