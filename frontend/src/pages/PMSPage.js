import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Grid,
  Paper,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  Snackbar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Avatar,
  Divider,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Sync as SyncIcon,
  Settings as SettingsIcon,
  Person as GuestIcon,
  Hotel as HotelIcon,
  Assignment as ReservationIcon,
  Receipt as BillingIcon,
  CheckCircle,
  Cancel,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  RestoreFromTrash as RestoreIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const PMSPage = () => {
  const [pmsConfig, setPmsConfig] = useState({});
  const [guests, setGuests] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [syncHistory, setSyncHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [configDialog, setConfigDialog] = useState(false);
  const [endpointDialog, setEndpointDialog] = useState({ open: false, endpoint: null });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const { socket, connected } = useSocket();
  const { user } = useAuth();

  // Tab labels
  const tabLabels = ['Dashboard', 'Guests', 'Configuration', 'Sync History'];

  useEffect(() => {
    fetchData();
    
    // Socket event listeners for real-time updates
    if (socket) {
      socket.on('pms:sync-started', handleSyncStarted);
      socket.on('pms:sync-completed', handleSyncCompleted);
      socket.on('pms:sync-failed', handleSyncFailed);
      socket.on('pms:guest-checkin', handleGuestCheckin);
      socket.on('pms:guest-checkout', handleGuestCheckout);

      return () => {
        socket.off('pms:sync-started');
        socket.off('pms:sync-completed');
        socket.off('pms:sync-failed');
        socket.off('pms:guest-checkin');
        socket.off('pms:guest-checkout');
      };
    }
  }, [socket]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [configRes, guestsRes, reservationsRes, historyRes] = await Promise.all([
        axios.get('/api/pms/config', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        axios.get('/api/pms/guests', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        axios.get('/api/pms/reservations', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        axios.get('/api/pms/sync-history', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      setPmsConfig(configRes.data);
      setGuests(guestsRes.data);
      setReservations(reservationsRes.data);
      setSyncHistory(historyRes.data);
    } catch (err) {
      console.error('Error fetching PMS data:', err);
      setError('Failed to load PMS data');
    } finally {
      setLoading(false);
    }
  };

  // Real-time event handlers
  const handleSyncStarted = (data) => {
    setSyncing(true);
    showSnackbar(`PMS sync started by ${data.triggeredBy}`, 'info');
  };

  const handleSyncCompleted = (data) => {
    setSyncing(false);
    fetchData(); // Refresh all data
    showSnackbar(`PMS sync completed: ${data.guestsSync} guests synced`, 'success');
  };

  const handleSyncFailed = (data) => {
    setSyncing(false);
    showSnackbar(`PMS sync failed: ${data.error}`, 'error');
  };

  const handleGuestCheckin = (data) => {
    setGuests(prev => [...prev, data.guest]);
    showSnackbar(`Guest checked in: ${data.guest.name} - Room ${data.guest.room_number}`, 'success');
  };

  const handleGuestCheckout = (data) => {
    setGuests(prev => prev.filter(guest => guest.id !== data.guestId));
    showSnackbar(`Guest checked out: Room ${data.room_number}`, 'info');
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      await axios.post('/api/pms/sync', {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      showSnackbar('Manual sync triggered', 'info');
    } catch (err) {
      showSnackbar('Failed to trigger sync', 'error');
      setSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      const response = await axios.post('/api/pms/test-connection', {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      showSnackbar(response.data.message, response.data.success ? 'success' : 'warning');
    } catch (err) {
      showSnackbar('Connection test failed', 'error');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          PMS Integration
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Chip
            icon={pmsConfig.connected ? <CheckCircle /> : <Cancel />}
            label={pmsConfig.connected ? 'PMS Connected' : 'PMS Disconnected'}
            color={pmsConfig.connected ? 'success' : 'error'}
            variant="outlined"
          />
          <Button
            variant="contained"
            startIcon={<SyncIcon />}
            onClick={handleManualSync}
            disabled={syncing || !pmsConfig.connected}
          >
            {syncing ? 'Syncing...' : 'Manual Sync'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setConfigDialog(true)}
          >
            Configure
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {syncing && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <CircularProgress size={20} />
              <Typography>Synchronizing with PMS...</Typography>
            </Box>
            <LinearProgress sx={{ mt: 2 }} />
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            {tabLabels.map((label, index) => (
              <Tab key={index} label={label} />
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Tab Content */}
      {activeTab === 0 && (
        <DashboardTab
          pmsConfig={pmsConfig}
          guests={guests}
          reservations={reservations}
          onTestConnection={handleTestConnection}
          onRefresh={fetchData}
        />
      )}

      {activeTab === 1 && (
        <GuestsTab
          guests={guests}
          reservations={reservations}
          onRefresh={fetchData}
        />
      )}

      {activeTab === 2 && (
        <ConfigurationTab
          pmsConfig={pmsConfig}
          onSave={fetchData}
          onSnackbar={showSnackbar}
          user={user}
        />
      )}

      {activeTab === 3 && (
        <SyncHistoryTab
          syncHistory={syncHistory}
          onRefresh={fetchData}
        />
      )}

      {/* Configuration Dialog */}
      <PMSConfigDialog
        open={configDialog}
        config={pmsConfig}
        onClose={() => setConfigDialog(false)}
        onSave={fetchData}
        onSnackbar={showSnackbar}
        user={user}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
};

// Dashboard Tab Component
const DashboardTab = ({ pmsConfig, guests, reservations, onTestConnection, onRefresh }) => {
  const activeGuests = guests.filter(guest => guest.status === 'checked_in');
  const todayCheckIns = guests.filter(guest => {
    const checkIn = new Date(guest.check_in_date);
    const today = new Date();
    return checkIn.toDateString() === today.toDateString();
  });
  const todayCheckOuts = reservations.filter(res => {
    const checkOut = new Date(res.check_out_date);
    const today = new Date();
    return checkOut.toDateString() === today.toDateString();
  });

  return (
    <Grid container spacing={3}>
      {/* Statistics Cards */}
      <Grid item xs={12} sm={6} md={3}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h4" color="primary">
            {activeGuests.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Active Guests
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h4" color="success.main">
            {todayCheckIns.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Today's Check-ins
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h4" color="warning.main">
            {todayCheckOuts.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Today's Check-outs
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h4" color="info.main">
            {pmsConfig.last_sync ? new Date(pmsConfig.last_sync).toLocaleTimeString() : 'Never'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last Sync
          </Typography>
        </Paper>
      </Grid>

      {/* Connection Status */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              PMS Connection Status
            </Typography>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Chip
                icon={pmsConfig.connected ? <CheckCircle /> : <Cancel />}
                label={pmsConfig.connected ? 'Connected' : 'Disconnected'}
                color={pmsConfig.connected ? 'success' : 'error'}
              />
              {pmsConfig.base_url && (
                <Typography variant="body2" color="text.secondary">
                  {pmsConfig.base_url}
                </Typography>
              )}
            </Box>
            
            {pmsConfig.last_error && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Last Error: {pmsConfig.last_error}
              </Alert>
            )}

            <Box display="flex" gap={2}>
              <Button
                variant="outlined"
                onClick={onTestConnection}
                disabled={!pmsConfig.base_url}
              >
                Test Connection
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={onRefresh}
              >
                Refresh
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Recent Activity */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent PMS Activity
            </Typography>
            <List dense>
              {guests.slice(0, 5).map((guest, index) => (
                <ListItem key={guest.id} divider={index < 4}>
                  <ListItemIcon>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                      <GuestIcon />
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={guest.name}
                    secondary={`Room ${guest.room_number} • ${guest.status}`}
                  />
                  <Chip
                    label={guest.status === 'checked_in' ? 'Active' : 'Checkout'}
                    size="small"
                    color={guest.status === 'checked_in' ? 'success' : 'default'}
                  />
                </ListItem>
              ))}
              {guests.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary="No recent activity"
                    secondary="PMS data will appear here after synchronization"
                  />
                </ListItem>
              )}
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

// Guests Tab Component
const GuestsTab = ({ guests, reservations, onRefresh }) => {
  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">
            Guest Information
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
          >
            Refresh
          </Button>
        </Box>

        {guests.length === 0 ? (
          <Box textAlign="center" py={4}>
            <GuestIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No guest data available
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Configure PMS integration to see guest information
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Guest Name</TableCell>
                  <TableCell>Room</TableCell>
                  <TableCell>Check-in</TableCell>
                  <TableCell>Check-out</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Bill Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {guests.map((guest) => (
                  <TableRow key={guest.id}>
                    <TableCell>{guest.name}</TableCell>
                    <TableCell>{guest.room_number}</TableCell>
                    <TableCell>
                      {guest.check_in_date ? new Date(guest.check_in_date).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {guest.check_out_date ? new Date(guest.check_out_date).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={guest.status}
                        size="small"
                        color={guest.status === 'checked_in' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {guest.bill_total ? `$${guest.bill_total.toFixed(2)}` : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};

// Configuration Tab Component
const ConfigurationTab = ({ pmsConfig, onSave, onSnackbar, user }) => {
  const canEdit = user.role === 'super_admin';

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              PMS Configuration
            </Typography>
            
            {!canEdit && (
              <Alert severity="info" sx={{ mb: 3 }}>
                Only super admin can modify PMS configuration
              </Alert>
            )}

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="PMS Base URL"
                  value={pmsConfig.base_url || ''}
                  disabled={!canEdit}
                  helperText="e.g., http://192.168.1.200:7001/api"
                  margin="normal"
                />
                <TextField
                  fullWidth
                  type="number"
                  label="Sync Interval (minutes)"
                  value={pmsConfig.sync_interval || 15}
                  disabled={!canEdit}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={pmsConfig.auto_sync || true}
                      disabled={!canEdit}
                    />
                  }
                  label="Auto Sync"
                  sx={{ display: 'block', mt: 2 }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={pmsConfig.enable_welcome_messages || true}
                      disabled={!canEdit}
                    />
                  }
                  label="Enable Welcome Messages"
                  sx={{ display: 'block' }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={pmsConfig.enable_farewell_messages || true}
                      disabled={!canEdit}
                    />
                  }
                  label="Enable Farewell Messages"
                  sx={{ display: 'block' }}
                />
              </Grid>
            </Grid>

            {canEdit && (
              <Box mt={3}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={() => onSnackbar('Configuration saved', 'success')}
                >
                  Save Configuration
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

// Sync History Tab Component
const SyncHistoryTab = ({ syncHistory, onRefresh }) => {
  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">
            Synchronization History
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
          >
            Refresh
          </Button>
        </Box>

        {syncHistory.length === 0 ? (
          <Box textAlign="center" py={4}>
            <SyncIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No sync history available
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date/Time</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Guests Synced</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Triggered By</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {syncHistory.map((sync, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {new Date(sync.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={sync.status}
                        size="small"
                        color={sync.status === 'success' ? 'success' : 'error'}
                      />
                    </TableCell>
                    <TableCell>{sync.guests_synced || 0}</TableCell>
                    <TableCell>{sync.duration || 'N/A'}</TableCell>
                    <TableCell>{sync.triggered_by || 'System'}</TableCell>
                    <TableCell>{sync.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};

// PMS Configuration Dialog
const PMSConfigDialog = ({ open, config, onClose, onSave, onSnackbar, user }) => {
  const [formData, setFormData] = useState({
    base_url: '',
    sync_interval: 15,
    auto_sync: true,
    enable_welcome_messages: true,
    enable_farewell_messages: true
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData({
        base_url: config.base_url || '',
        sync_interval: config.sync_interval || 15,
        auto_sync: config.auto_sync || true,
        enable_welcome_messages: config.enable_welcome_messages || true,
        enable_farewell_messages: config.enable_farewell_messages || true
      });
    }
  }, [config]);

  const handleSave = async () => {
    if (user.role !== 'super_admin') {
      onSnackbar('Only super admin can modify PMS configuration', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await axios.put('/api/pms/config', formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      onSave();
      onSnackbar('PMS configuration saved successfully', 'success');
      onClose();
    } catch (err) {
      onSnackbar('Failed to save PMS configuration', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>PMS Configuration</DialogTitle>
      <DialogContent>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="PMS Base URL"
              value={formData.base_url}
              onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
              margin="dense"
              helperText="Opera PMS API base URL (e.g., http://192.168.1.200:7001/api)"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Sync Interval (minutes)"
              value={formData.sync_interval}
              onChange={(e) => setFormData({ ...formData, sync_interval: parseInt(e.target.value) })}
              margin="dense"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.auto_sync}
                  onChange={(e) => setFormData({ ...formData, auto_sync: e.target.checked })}
                />
              }
              label="Enable Auto Sync"
              sx={{ mt: 2 }}
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Guest Messages
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.enable_welcome_messages}
                  onChange={(e) => setFormData({ ...formData, enable_welcome_messages: e.target.checked })}
                />
              }
              label="Enable Welcome Messages"
              sx={{ display: 'block' }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.enable_farewell_messages}
                  onChange={(e) => setFormData({ ...formData, enable_farewell_messages: e.target.checked })}
                />
              }
              label="Enable Farewell Messages"
              sx={{ display: 'block' }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={submitting || user.role !== 'super_admin'}
        >
          {submitting ? 'Saving...' : 'Save Configuration'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PMSPage;
