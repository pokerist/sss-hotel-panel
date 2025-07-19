import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
} from '@mui/material';
import {
  Devices as DevicesIcon,
  Apps as AppsIcon,
  Wallpaper as BackgroundIcon,
  Business as PMSIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';

const StatCard = ({ title, value, icon, color = 'primary', subtitle, trend }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography color="textSecondary" gutterBottom variant="overline">
            {title}
          </Typography>
          <Typography variant="h3" component="div" color={color}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="textSecondary">
              {subtitle}
            </Typography>
          )}
          {trend && (
            <Box display="flex" alignItems="center" mt={1}>
              <TrendingUpIcon fontSize="small" color="success" />
              <Typography variant="body2" color="success.main" ml={0.5}>
                {trend}
              </Typography>
            </Box>
          )}
        </Box>
        <Box color={`${color}.main`}>
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const [stats, setStats] = useState({
    devices: { total: 0, online: 0, pending: 0 },
    apps: { total: 0, active: 0 },
    backgrounds: { total: 0, bundles: 0 },
    pms: { connected: false, lastSync: null }
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { connected } = useSocket();

  // Mock activity data
  const mockActivityData = [
    { time: '10:30', devices: 15, event: 'Device approved: Room 204' },
    { time: '10:15', devices: 14, event: 'New device registration: MAC 00:11:22:33:44:55' },
    { time: '10:00', devices: 14, event: 'PMS sync completed: 25 guests' },
    { time: '09:45', devices: 13, event: 'Background bundle assigned to 5 rooms' },
    { time: '09:30', devices: 13, event: 'App installed: Netflix on Room 302' },
  ];

  const mockChartData = [
    { name: '6h ago', devices: 10, active: 8 },
    { name: '5h ago', devices: 12, active: 10 },
    { name: '4h ago', devices: 14, active: 11 },
    { name: '3h ago', devices: 15, active: 13 },
    { name: '2h ago', devices: 16, active: 14 },
    { name: '1h ago', devices: 17, active: 15 },
    { name: 'Now', devices: 18, active: 16 },
  ];

  const mockPieData = [
    { name: 'Online', value: 16, color: '#4caf50' },
    { name: 'Offline', value: 2, color: '#f44336' },
    { name: 'Pending', value: 3, color: '#ff9800' },
  ];

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // In a real implementation, these would be actual API calls
      // For now, using mock data
      
      setTimeout(() => {
        setStats({
          devices: { total: 21, online: 16, pending: 3, offline: 2 },
          apps: { total: 12, active: 10 },
          backgrounds: { total: 25, bundles: 4 },
          pms: { connected: true, lastSync: new Date().toISOString() }
        });
        setRecentActivity(mockActivityData);
        setLoading(false);
      }, 1000);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          <Button color="inherit" size="small" onClick={fetchDashboardData}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Dashboard
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Chip 
            icon={connected ? <CheckCircleIcon /> : <ErrorIcon />}
            label={connected ? 'Connected' : 'Disconnected'}
            color={connected ? 'success' : 'error'}
            variant="outlined"
          />
          <IconButton onClick={fetchDashboardData}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Statistics Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Devices"
            value={stats.devices.total}
            icon={<DevicesIcon sx={{ fontSize: 40 }} />}
            subtitle={`${stats.devices.online} online, ${stats.devices.pending} pending`}
            trend="+2 today"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Apps"
            value={stats.apps.active}
            icon={<AppsIcon sx={{ fontSize: 40 }} />}
            subtitle={`${stats.apps.total} total apps`}
            color="success"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Background Bundles"
            value={stats.backgrounds.bundles}
            icon={<BackgroundIcon sx={{ fontSize: 40 }} />}
            subtitle={`${stats.backgrounds.total} total backgrounds`}
            color="info"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="PMS Status"
            value={stats.pms.connected ? "Connected" : "Disconnected"}
            icon={<PMSIcon sx={{ fontSize: 40 }} />}
            subtitle="Last sync: 5 min ago"
            color={stats.pms.connected ? "success" : "error"}
          />
        </Grid>

        {/* Device Activity Chart */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Device Activity (Last 6 Hours)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mockChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="devices" 
                    stroke="#1976d2" 
                    strokeWidth={2}
                    name="Total Devices"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="active" 
                    stroke="#4caf50" 
                    strokeWidth={2}
                    name="Active Devices"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Device Status Distribution */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Device Status
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={mockPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {mockPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <Box mt={2}>
                {mockPieData.map((entry, index) => (
                  <Box key={entry.name} display="flex" alignItems="center" mb={1}>
                    <Box
                      width={12}
                      height={12}
                      borderRadius="50%"
                      backgroundColor={entry.color}
                      mr={1}
                    />
                    <Typography variant="body2">
                      {entry.name}: {entry.value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              <List>
                {recentActivity.map((activity, index) => (
                  <ListItem key={index} divider={index < recentActivity.length - 1}>
                    <ListItemIcon>
                      {activity.event.includes('approved') ? (
                        <CheckCircleIcon color="success" />
                      ) : activity.event.includes('error') || activity.event.includes('failed') ? (
                        <ErrorIcon color="error" />
                      ) : (
                        <WarningIcon color="warning" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={activity.event}
                      secondary={`${activity.time} • ${activity.devices} total devices`}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
