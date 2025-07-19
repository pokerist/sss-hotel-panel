import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

const BackgroundsPage = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Background Library
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1">
            Background and wallpaper management - upload images/videos, create bundles, 
            and assign them to specific rooms or devices for customized TV backgrounds.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Features: File upload, bundle creation, assignment management, preview
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default BackgroundsPage;
