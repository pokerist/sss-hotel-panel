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
  Checkbox,
  ListItemAvatar,
  OutlinedInput,
  Divider,
  CardMedia,
  CardActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  Assignment as AssignIcon,
  Apps as AppsIcon,
  GetApp as InstallIcon,
  DragIndicator as DragIcon,
  CheckCircle,
  Cancel,
  Phone as AndroidIcon,
  Store as StoreIcon,
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const AppsPage = () => {
  const [apps, setApps] = useState([]);
  const [devices, setDevices] = useState([]);
  const [deviceApps, setDeviceApps] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedApps, setSelectedApps] = useState([]);
  const [createDialog, setCreateDialog] = useState({ open: false, app: null });
  const [assignDialog, setAssignDialog] = useState({ open: false });
  const [reorderDialog, setReorderDialog] = useState({ open: false, device: null });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [uploading, setUploading] = useState(false);

  const { socket, connected } = useSocket();
  const { user } = useAuth();

  // Tab labels
  const tabLabels = ['All Apps', 'Device Apps', 'Assignments'];

  useEffect(() => {
    fetchData();
    
    // Socket event listeners for real-time updates
    if (socket) {
      socket.on('app:created', handleAppCreated);
      socket.on('app:updated', handleAppUpdated);
      socket.on('app:assigned', handleAppAssigned);
      socket.on('app:install-result', handleInstallResult);

      return () => {
        socket.off('app:created');
        socket.off('app:updated');
        socket.off('app:assigned');
        socket.off('app:install-result');
      };
    }
  }, [socket]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [appsRes, devicesRes, deviceAppsRes] = await Promise.all([
        axios.get('/api/apps', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        axios.get('/api/devices', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        axios.get('/api/apps/device-assignments', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      setApps(appsRes.data);
      setDevices(devicesRes.data.filter(device => device.status === 'active'));
      setDeviceApps(deviceAppsRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Real-time event handlers
  const handleAppCreated = (data) => {
    setApps(prev => [...prev, data.app]);
    showSnackbar(`App created: ${data.app.name}`, 'success');
  };

  const handleAppUpdated = (data) => {
    setApps(prev => prev.map(app => app.id === data.app.id ? data.app : app));
    showSnackbar(`App updated: ${data.app.name}`, 'success');
  };

  const handleAppAssigned = (data) => {
    fetchData(); // Refresh all data to get updated assignments
    showSnackbar(`Apps assigned to ${data.assignments.length} device(s)`, 'success');
  };

  const handleInstallResult = (data) => {
    const variant = data.status === 'success' ? 'success' : 'error';
    const message = data.status === 'success' 
      ? `App installed successfully on ${data.deviceName || 'device'}`
      : `App installation failed: ${data.error}`;
    
    showSnackbar(message, variant);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleDeleteApp = async (appId) => {
    if (window.confirm('Are you sure you want to delete this app?')) {
      try {
        await axios.delete(`/api/apps/${appId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setApps(prev => prev.filter(app => app.id !== appId));
        showSnackbar('App deleted', 'success');
      } catch (err) {
        showSnackbar('Failed to delete app', 'error');
      }
    }
  };

  const handleInstallApp = async (appId, deviceId) => {
    try {
      await axios.post(`/api/apps/${appId}/install`, {
        device_id: deviceId
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      showSnackbar('Installation request sent', 'info');
    } catch (err) {
      showSnackbar('Failed to send installation request', 'error');
    }
  };

  const handleBulkAssign = async () => {
    if (selectedApps.length === 0) {
      showSnackbar('Please select apps to assign', 'error');
      return;
    }
    setAssignDialog({ open: true });
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
          Apps Library
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Chip
            icon={connected ? <CheckCircle /> : <Cancel />}
            label={connected ? 'Real-time Connected' : 'Real-time Disconnected'}
            color={connected ? 'success' : 'error'}
            variant="outlined"
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialog({ open: true, app: null })}
          >
            Add App
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h4" color="primary">
              {apps.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Apps
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h4" color="success.main">
              {Object.keys(deviceApps).length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Devices with Apps
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h4" color="info.main">
              {devices.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active Devices
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h4" color="warning.main">
              {Object.values(deviceApps).reduce((sum, apps) => sum + apps.length, 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Assignments
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
              {tabLabels.map((label, index) => (
                <Tab key={index} label={label} />
              ))}
            </Tabs>
            
            {selectedApps.length > 0 && activeTab === 0 && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<AssignIcon />}
                onClick={handleBulkAssign}
              >
                Assign Apps ({selectedApps.length})
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Tab Content */}
      {activeTab === 0 && (
        <AppsTab
          apps={apps}
          selectedApps={selectedApps}
          setSelectedApps={setSelectedApps}
          onDelete={handleDeleteApp}
          onEdit={(app) => setCreateDialog({ open: true, app })}
        />
      )}

      {activeTab === 1 && (
        <DeviceAppsTab
          devices={devices}
          deviceApps={deviceApps}
          apps={apps}
          onInstall={handleInstallApp}
          onReorder={(device) => setReorderDialog({ open: true, device })}
        />
      )}

      {activeTab === 2 && (
        <AssignmentsTab
          devices={devices}
          apps={apps}
          deviceApps={deviceApps}
          onRefresh={fetchData}
        />
      )}

      {/* Create/Edit App Dialog */}
      <AppDialog
        open={createDialog.open}
        app={createDialog.app}
        onClose={() => setCreateDialog({ open: false, app: null })}
        onSave={fetchData}
        onSnackbar={showSnackbar}
      />

      {/* Bulk Assignment Dialog */}
      <BulkAssignDialog
        open={assignDialog.open}
        apps={selectedApps.map(id => apps.find(app => app.id === id)).filter(Boolean)}
        devices={devices}
        onClose={() => setAssignDialog({ open: false })}
        onAssign={() => {
          fetchData();
          setSelectedApps([]);
          setAssignDialog({ open: false });
        }}
        onSnackbar={showSnackbar}
      />

      {/* App Reorder Dialog */}
      <ReorderDialog
        open={reorderDialog.open}
        device={reorderDialog.device}
        apps={reorderDialog.device ? deviceApps[reorderDialog.device.id] || [] : []}
        onClose={() => setReorderDialog({ open: false, device: null })}
        onSave={fetchData}
        onSnackbar={showSnackbar}
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

// Apps Tab Component
const AppsTab = ({ apps, selectedApps, setSelectedApps, onDelete, onEdit }) => {
  const handleSelectApp = (appId) => {
    setSelectedApps(prev => 
      prev.includes(appId)
        ? prev.filter(id => id !== appId)
        : [...prev, appId]
    );
  };

  if (apps.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box textAlign="center" py={4}>
            <AppsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No apps added yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add some apps to get started
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Grid container spacing={3}>
      {apps.map((app) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={app.id}>
          <Card 
            sx={{ 
              height: '100%',
              border: selectedApps.includes(app.id) ? 2 : 0,
              borderColor: 'primary.main',
              cursor: 'pointer',
              '&:hover': { elevation: 4 }
            }}
            onClick={() => handleSelectApp(app.id)}
          >
            <CardMedia
              sx={{
                height: 120,
                backgroundColor: 'grey.100',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              {app.icon_url ? (
                <img
                  src={app.icon_url}
                  alt={app.name}
                  style={{ width: 64, height: 64, objectFit: 'contain' }}
                />
              ) : (
                <AndroidIcon sx={{ fontSize: 64, color: 'grey.400' }} />
              )}
              <Checkbox
                checked={selectedApps.includes(app.id)}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)'
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </CardMedia>
            <CardContent>
              <Typography variant="h6" gutterBottom noWrap>
                {app.name}
              </Typography>
              {app.description && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {app.description.length > 100 
                    ? `${app.description.substring(0, 100)}...` 
                    : app.description
                  }
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" display="block">
                Package: {app.package_name || 'N/A'}
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={(e) => { e.stopPropagation(); onEdit(app); }}>
                <EditIcon fontSize="small" />
                Edit
              </Button>
              <Button 
                size="small" 
                color="error"
                onClick={(e) => { e.stopPropagation(); onDelete(app.id); }}
              >
                <DeleteIcon fontSize="small" />
                Delete
              </Button>
              {app.store_url && (
                <Button
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(app.store_url, '_blank');
                  }}
                >
                  <StoreIcon fontSize="small" />
                  Store
                </Button>
              )}
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

// Device Apps Tab Component
const DeviceAppsTab = ({ devices, deviceApps, apps, onInstall, onReorder }) => {
  if (devices.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box textAlign="center" py={4}>
            <AndroidIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No active devices
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Devices must be active to manage apps
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Grid container spacing={3}>
      {devices.map((device) => {
        const assignedApps = deviceApps[device.id] || [];
        return (
          <Grid item xs={12} md={6} key={device.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    Room {device.room_number || device.id}
                  </Typography>
                  <Box>
                    <Tooltip title="Reorder Apps">
                      <IconButton size="small" onClick={() => onReorder(device)}>
                        <DragIcon />
                      </IconButton>
                    </Tooltip>
                    <Chip 
                      label={device.connection_status} 
                      color={device.connection_status === 'online' ? 'success' : 'error'}
                      size="small"
                    />
                  </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {assignedApps.length} app(s) assigned
                </Typography>

                <List dense>
                  {assignedApps.map((appAssignment, index) => {
                    const app = apps.find(a => a.id === appAssignment.app_id);
                    if (!app) return null;
                    
                    return (
                      <ListItem key={app.id} divider={index < assignedApps.length - 1}>
                        <ListItemAvatar>
                          <Avatar
                            src={app.icon_url}
                            sx={{ width: 32, height: 32 }}
                          >
                            <AndroidIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={app.name}
                          secondary={`Order: ${appAssignment.order || index + 1}`}
                        />
                        <ListItemSecondaryAction>
                          <Tooltip title="Install App">
                            <IconButton
                              size="small"
                              onClick={() => onInstall(app.id, device.id)}
                              disabled={device.connection_status !== 'online'}
                            >
                              <InstallIcon />
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                    );
                  })}
                  {assignedApps.length === 0 && (
                    <ListItem>
                      <ListItemText
                        primary="No apps assigned"
                        secondary="Use the Assignments tab to assign apps"
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
};

// Assignments Tab Component
const AssignmentsTab = ({ devices, apps, deviceApps, onRefresh }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          App Assignments Overview
        </Typography>
        <List>
          {devices.map((device) => {
            const assignedApps = deviceApps[device.id] || [];
            return (
              <Box key={device.id}>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar>
                      {device.room_number || '?'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={`Room ${device.room_number || device.id}`}
                    secondary={`${assignedApps.length} apps assigned • ${device.status} • ${device.connection_status}`}
                  />
                </ListItem>
                {assignedApps.length > 0 && (
                  <Box pl={9} pb={2}>
                    <Grid container spacing={1}>
                      {assignedApps.map((appAssignment) => {
                        const app = apps.find(a => a.id === appAssignment.app_id);
                        if (!app) return null;
                        return (
                          <Grid item key={app.id}>
                            <Chip
                              avatar={<Avatar src={app.icon_url} sx={{ width: 20, height: 20 }} />}
                              label={app.name}
                              size="small"
                              variant="outlined"
                            />
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Box>
                )}
                <Divider />
              </Box>
            );
          })}
        </List>
      </CardContent>
    </Card>
  );
};

// App Dialog Component (Create/Edit)
const AppDialog = ({ open, app, onClose, onSave, onSnackbar }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    packageName: '',
    url: '',
    icon: null,
    category: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [iconPreview, setIconPreview] = useState(null);

  useEffect(() => {
    if (app) {
      setFormData({
        name: app.name || '',
        description: app.description || '',
        packageName: app.packageName || '',
        url: app.url || '',
        icon: null,
        category: app.category || ''
      });
      setIconPreview(app.icon_url);
    } else {
      setFormData({
        name: '',
        description: '',
        packageName: '',
        url: '',
        icon: null,
        category: ''
      });
      setIconPreview(null);
    }
  }, [app]);

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif']
    },
    multiple: false,
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        setFormData({ ...formData, icon: file });
        setIconPreview(URL.createObjectURL(file));
      }
    }
  });

  const handleSave = async () => {
    if (!formData.name.trim()) {
      onSnackbar('App name is required', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const submitData = new FormData();
      
      submitData.append('name', formData.name);
      submitData.append('description', formData.description);
      submitData.append('packageName', formData.packageName);
      submitData.append('url', formData.url);
      submitData.append('category', formData.category);
      
      if (formData.icon) {
        submitData.append('icon', formData.icon);
      }

      const url = app ? `/api/apps/${app.id}` : '/api/apps';
      const method = app ? 'put' : 'post';
      
      await axios[method](url, submitData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      onSave();
      onSnackbar(`App ${app ? 'updated' : 'created'} successfully`, 'success');
      onClose();
    } catch (err) {
      onSnackbar(`Failed to ${app ? 'update' : 'create'} app`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{app ? 'Edit App' : 'Add New App'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="App Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              margin="dense"
              required
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              margin="dense"
            />
            <TextField
              fullWidth
              label="Package Name"
              value={formData.packageName}
              onChange={(e) => setFormData({ ...formData, packageName: e.target.value })}
              margin="dense"
              helperText="e.g., com.netflix.mediaclient"
            />
            <TextField
              fullWidth
              label="Store URL"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              margin="dense"
              helperText="Google Play Store or APK download URL"
            />
            <FormControl fullWidth margin="dense">
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                label="Category"
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="entertainment">Entertainment</MenuItem>
                <MenuItem value="streaming">Streaming</MenuItem>
                <MenuItem value="games">Games</MenuItem>
                <MenuItem value="education">Education</MenuItem>
                <MenuItem value="news">News</MenuItem>
                <MenuItem value="sports">Sports</MenuItem>
                <MenuItem value="utilities">Utilities</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" gutterBottom>
              App Icon
            </Typography>
            <Box
              {...getRootProps()}
              sx={{
                border: '2px dashed',
                borderColor: 'grey.300',
                borderRadius: 2,
                p: 2,
                textAlign: 'center',
                cursor: 'pointer',
                mb: 2,
                '&:hover': {
                  backgroundColor: 'action.hover',
                  borderColor: 'primary.main'
                }
              }}
            >
              <input {...getInputProps()} />
              {iconPreview ? (
                <img
                  src={iconPreview}
                  alt="App icon preview"
                  style={{ width: 64, height: 64, objectFit: 'contain' }}
                />
              ) : (
                <Box>
                  <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Drop icon here or click to upload
                  </Typography>
                </Box>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Recommended: 512x512px PNG
            </Typography>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={submitting}
        >
          {submitting ? 'Saving...' : (app ? 'Update App' : 'Create App')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Bulk Assignment Dialog Component
const BulkAssignDialog = ({ open, apps, devices, onClose, onAssign, onSnackbar }) => {
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleAssign = async () => {
    if (selectedDevices.length === 0) {
      onSnackbar('Please select at least one device', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await axios.post('/api/apps/bulk-assign', {
        apps: apps.map(app => app.id),
        devices: selectedDevices
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      onAssign();
      onSnackbar(`Apps assigned to ${selectedDevices.length} device(s)`, 'success');
    } catch (err) {
      onSnackbar('Failed to assign apps', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Assign Apps to Devices</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Assigning {apps.length} app(s) to selected devices:
        </Typography>
        
        <Box mb={2}>
          {apps.map((app) => (
            <Chip
              key={app.id}
              avatar={<Avatar src={app.icon_url} sx={{ width: 20, height: 20 }} />}
              label={app.name}
              size="small"
              sx={{ mr: 1, mb: 1 }}
            />
          ))}
        </Box>
        
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel>Select Devices</InputLabel>
          <Select
            multiple
            value={selectedDevices}
            onChange={(e) => setSelectedDevices(e.target.value)}
            input={<OutlinedInput label="Select Devices" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => {
                  const device = devices.find(d => d.id === value);
                  return (
                    <Chip 
                      key={value} 
                      label={`Room ${device?.room_number || device?.id}`} 
                      size="small" 
                    />
                  );
                })}
              </Box>
            )}
          >
            {devices.map((device) => (
              <MenuItem key={device.id} value={device.id}>
                <Checkbox checked={selectedDevices.indexOf(device.id) > -1} />
                <ListItemText 
                  primary={`Room ${device.room_number || device.id}`}
                  secondary={`${device.status} • ${device.connection_status}`}
                />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleAssign} 
          variant="contained"
          disabled={submitting || selectedDevices.length === 0}
        >
          {submitting ? 'Assigning...' : 'Assign Apps'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Reorder Dialog Component
const ReorderDialog = ({ open, device, apps, onClose, onSave, onSnackbar }) => {
  const [reorderedApps, setReorderedApps] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (apps) {
      setReorderedApps([...apps].sort((a, b) => (a.order || 0) - (b.order || 0)));
    }
  }, [apps]);

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(reorderedApps);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order values
    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index + 1
    }));

    setReorderedApps(updatedItems);
  };

  const handleSave = async () => {
    try {
      setSubmitting(true);
      await axios.post(`/api/apps/reorder/${device.id}`, {
        apps: reorderedApps.map((app, index) => ({
          app_id: app.app_id,
          order: index + 1
        }))
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      onSave();
      onSnackbar('App order updated successfully', 'success');
      onClose();
    } catch (err) {
      onSnackbar('Failed to update app order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!device) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Reorder Apps: Room {device.room_number || device.id}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Drag and drop to reorder the apps as they will appear on the device:
        </Typography>
        
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="apps">
            {(provided) => (
              <List {...provided.droppableProps} ref={provided.innerRef}>
                {reorderedApps.map((appAssignment, index) => {
                  // Find the actual app data - need to get from a higher scope
                  return (
                    <Draggable 
                      key={`${appAssignment.app_id}-${index}`} 
                      draggableId={`${appAssignment.app_id}-${index}`} 
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <ListItem
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          sx={{
                            backgroundColor: snapshot.isDragging ? 'action.hover' : 'inherit',
                            border: snapshot.isDragging ? '1px dashed primary.main' : 'none',
                            borderRadius: 1,
                            mb: 1
                          }}
                        >
                          <ListItemIcon>
                            <DragIcon />
                          </ListItemIcon>
                          <ListItemAvatar>
                            <Avatar sx={{ width: 32, height: 32 }}>
                              {index + 1}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={`App ${appAssignment.app_id}`}
                            secondary={`Position ${index + 1}`}
                          />
                        </ListItem>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </List>
            )}
          </Droppable>
        </DragDropContext>
        
        {reorderedApps.length === 0 && (
          <Box textAlign="center" py={4}>
            <Typography variant="body2" color="text.secondary">
              No apps assigned to this device
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={submitting || reorderedApps.length === 0}
        >
          {submitting ? 'Saving...' : 'Save Order'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AppsPage;
