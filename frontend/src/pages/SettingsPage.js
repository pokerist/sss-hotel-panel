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
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  CloudUpload as UploadIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
  Palette as BrandingIcon,
  Message as MessageIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle,
  Cancel,
  SupervisorAccount as SuperAdminIcon,
  AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const SettingsPage = () => {
  const [settings, setSettings] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [userDialog, setUserDialog] = useState({ open: false, user: null });
  const [brandingDialog, setBrandingDialog] = useState(false);
  const [messageDialog, setMessageDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [saving, setSaving] = useState(false);

  const { socket, connected } = useSocket();
  const { user } = useAuth();

  // Tab labels
  const tabLabels = ['General', 'Branding', 'Users', 'Messages', 'Security'];

  useEffect(() => {
    fetchData();
    
    // Socket event listeners for real-time updates
    if (socket) {
      socket.on('setting:updated', handleSettingUpdated);
      socket.on('user:created', handleUserCreated);
      socket.on('user:updated', handleUserUpdated);

      return () => {
        socket.off('setting:updated');
        socket.off('user:created');
        socket.off('user:updated');
      };
    }
  }, [socket]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [settingsRes, usersRes] = await Promise.all([
        axios.get('/api/settings', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        axios.get('/api/settings/users', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      setSettings(settingsRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  // Real-time event handlers
  const handleSettingUpdated = (data) => {
    setSettings(prev => ({ ...prev, [data.key]: data.value }));
    showSnackbar(`Setting updated: ${data.key}`, 'success');
  };

  const handleUserCreated = (data) => {
    setUsers(prev => [...prev, data.user]);
    showSnackbar(`User created: ${data.user.email}`, 'success');
  };

  const handleUserUpdated = (data) => {
    setUsers(prev => prev.map(u => u.id === data.user.id ? data.user : u));
    showSnackbar(`User updated: ${data.user.email}`, 'success');
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSaveSetting = async (key, value) => {
    try {
      setSaving(true);
      await axios.put('/api/settings', {
        key,
        value
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      setSettings(prev => ({ ...prev, [key]: value }));
      showSnackbar('Setting saved successfully', 'success');
    } catch (err) {
      showSnackbar('Failed to save setting', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (user.role !== 'super_admin') {
      showSnackbar('Only super admin can delete users', 'error');
      return;
    }

    if (userId === user.id) {
      showSnackbar('You cannot delete yourself', 'error');
      return;
    }

    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await axios.delete(`/api/settings/users/${userId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setUsers(prev => prev.filter(u => u.id !== userId));
        showSnackbar('User deleted', 'success');
      } catch (err) {
        showSnackbar('Failed to delete user', 'error');
      }
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
          System Settings
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Chip
            icon={connected ? <CheckCircle /> : <Cancel />}
            label={connected ? 'Real-time Connected' : 'Real-time Disconnected'}
            color={connected ? 'success' : 'error'}
            variant="outlined"
          />
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
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
        <GeneralTab
          settings={settings}
          onSave={handleSaveSetting}
          saving={saving}
        />
      )}

      {activeTab === 1 && (
        <BrandingTab
          settings={settings}
          onSave={handleSaveSetting}
          onSnackbar={showSnackbar}
          saving={saving}
        />
      )}

      {activeTab === 2 && (
        <UsersTab
          users={users}
          currentUser={user}
          onEdit={(user) => setUserDialog({ open: true, user })}
          onDelete={handleDeleteUser}
          onCreate={() => setUserDialog({ open: true, user: null })}
        />
      )}

      {activeTab === 3 && (
        <MessagesTab
          settings={settings}
          onSave={handleSaveSetting}
          onSnackbar={showSnackbar}
          saving={saving}
        />
      )}

      {activeTab === 4 && (
        <SecurityTab
          settings={settings}
          onSave={handleSaveSetting}
          onSnackbar={showSnackbar}
          saving={saving}
        />
      )}

      {/* User Dialog */}
      <UserDialog
        open={userDialog.open}
        user={userDialog.user}
        currentUser={user}
        onClose={() => setUserDialog({ open: false, user: null })}
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

// General Settings Tab
const GeneralTab = ({ settings, onSave, saving }) => {
  const [localSettings, setLocalSettings] = useState({
    panel_name: '',
    max_devices: 100,
    device_timeout: 300,
    log_retention_days: 30,
    auto_approve_devices: false,
    maintenance_mode: false
  });

  useEffect(() => {
    setLocalSettings({
      panel_name: settings.panel_name || '',
      max_devices: settings.max_devices || 100,
      device_timeout: settings.device_timeout || 300,
      log_retention_days: settings.log_retention_days || 30,
      auto_approve_devices: settings.auto_approve_devices || false,
      maintenance_mode: settings.maintenance_mode || false
    });
  }, [settings]);

  const handleSave = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    onSave(key, value);
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Panel Configuration
            </Typography>
            <TextField
              fullWidth
              label="Panel Name"
              value={localSettings.panel_name}
              onChange={(e) => setLocalSettings({ ...localSettings, panel_name: e.target.value })}
              onBlur={(e) => handleSave('panel_name', e.target.value)}
              margin="normal"
            />
            <TextField
              fullWidth
              type="number"
              label="Maximum Devices"
              value={localSettings.max_devices}
              onChange={(e) => setLocalSettings({ ...localSettings, max_devices: parseInt(e.target.value) })}
              onBlur={(e) => handleSave('max_devices', parseInt(e.target.value))}
              margin="normal"
            />
            <TextField
              fullWidth
              type="number"
              label="Device Timeout (seconds)"
              value={localSettings.device_timeout}
              onChange={(e) => setLocalSettings({ ...localSettings, device_timeout: parseInt(e.target.value) })}
              onBlur={(e) => handleSave('device_timeout', parseInt(e.target.value))}
              margin="normal"
              helperText="Time after which devices are considered offline"
            />
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              System Settings
            </Typography>
            <TextField
              fullWidth
              type="number"
              label="Log Retention (days)"
              value={localSettings.log_retention_days}
              onChange={(e) => setLocalSettings({ ...localSettings, log_retention_days: parseInt(e.target.value) })}
              onBlur={(e) => handleSave('log_retention_days', parseInt(e.target.value))}
              margin="normal"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={localSettings.auto_approve_devices}
                  onChange={(e) => handleSave('auto_approve_devices', e.target.checked)}
                />
              }
              label="Auto-approve new devices"
              sx={{ mt: 2, display: 'block' }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={localSettings.maintenance_mode}
                  onChange={(e) => handleSave('maintenance_mode', e.target.checked)}
                />
              }
              label="Maintenance Mode"
              sx={{ mt: 1, display: 'block' }}
            />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

// Branding Tab
const BrandingTab = ({ settings, onSave, onSnackbar, saving }) => {
  const [logoPreview, setLogoPreview] = useState(settings.panel_logo || null);
  const [uploading, setUploading] = useState(false);

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif']
    },
    multiple: false,
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        try {
          setUploading(true);
          const formData = new FormData();
          formData.append('logo', file);

          const response = await axios.post('/api/settings/upload-logo', formData, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'multipart/form-data'
            }
          });

          setLogoPreview(response.data.logo_url);
          onSave('panel_logo', response.data.logo_url);
          onSnackbar('Logo uploaded successfully', 'success');
        } catch (err) {
          onSnackbar('Failed to upload logo', 'error');
        } finally {
          setUploading(false);
        }
      }
    }
  });

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Panel Logo
            </Typography>
            <Box
              {...getRootProps()}
              sx={{
                border: '2px dashed',
                borderColor: 'grey.300',
                borderRadius: 2,
                p: 4,
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
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Panel logo"
                  style={{ maxWidth: 200, maxHeight: 100, objectFit: 'contain' }}
                />
              ) : (
                <Box>
                  <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Drop logo here or click to upload
                  </Typography>
                </Box>
              )}
            </Box>
            {uploading && <CircularProgress size={24} />}
            <Typography variant="caption" color="text.secondary">
              Recommended: 400x200px PNG with transparent background
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Theme Settings
            </Typography>
            <FormControl fullWidth margin="normal">
              <InputLabel>Primary Color</InputLabel>
              <Select
                value={settings.primary_color || '#1976d2'}
                onChange={(e) => onSave('primary_color', e.target.value)}
              >
                <MenuItem value="#1976d2">Blue</MenuItem>
                <MenuItem value="#388e3c">Green</MenuItem>
                <MenuItem value="#f57c00">Orange</MenuItem>
                <MenuItem value="#7b1fa2">Purple</MenuItem>
                <MenuItem value="#c62828">Red</MenuItem>
                <MenuItem value="#455a64">Blue Grey</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.dark_mode || false}
                  onChange={(e) => onSave('dark_mode', e.target.checked)}
                />
              }
              label="Dark Mode"
              sx={{ mt: 2, display: 'block' }}
            />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

// Users Management Tab
const UsersTab = ({ users, currentUser, onEdit, onDelete, onCreate }) => {
  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">
            User Management
          </Typography>
          {currentUser.role === 'super_admin' && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onCreate}
            >
              Add User
            </Button>
          )}
        </Box>

        <List>
          {users.map((user) => (
            <Box key={user.id}>
              <ListItem>
                <ListItemIcon>
                  <Avatar>
                    {user.role === 'super_admin' ? <SuperAdminIcon /> : <AdminIcon />}
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography>{user.name || user.email}</Typography>
                      {user.id === currentUser.id && (
                        <Chip label="You" size="small" color="primary" />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {user.email}
                      </Typography>
                      <Chip
                        label={user.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                        size="small"
                        color={user.role === 'super_admin' ? 'error' : 'primary'}
                        variant="outlined"
                      />
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Edit User">
                    <IconButton onClick={() => onEdit(user)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  {currentUser.role === 'super_admin' && user.id !== currentUser.id && (
                    <Tooltip title="Delete User">
                      <IconButton color="error" onClick={() => onDelete(user.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
            </Box>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};

// Messages Tab
const MessagesTab = ({ settings, onSave, onSnackbar, saving }) => {
  const [templates, setTemplates] = useState({
    welcome_message: '',
    farewell_message: ''
  });

  useEffect(() => {
    setTemplates({
      welcome_message: settings.welcome_message_template || 'Welcome, {{guest_name}}! We hope you enjoy your stay in room {{room_number}}.',
      farewell_message: settings.farewell_message_template || 'Dear {{guest_name}}, we hope you had a great stay. Checkout is at {{check_out_time}}. Safe travels!'
    });
  }, [settings]);

  const handleSaveTemplate = (key, value) => {
    setTemplates(prev => ({ ...prev, [key]: value }));
    onSave(`${key}_template`, value);
  };

  const resetToDefault = (key) => {
    const defaults = {
      welcome_message: 'Welcome, {{guest_name}}! We hope you enjoy your stay in room {{room_number}}.',
      farewell_message: 'Dear {{guest_name}}, we hope you had a great stay. Checkout is at {{check_out_time}}. Safe travels!'
    };
    
    setTemplates(prev => ({ ...prev, [key]: defaults[key] }));
    onSave(`${key}_template`, defaults[key]);
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Guest Message Templates
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Preview: Welcome, {'{{guest_name}}'} ! We hope you enjoy your stay in room {'{{room_number}}'} . Check-in: {'{{check_in_time}}'} , Check-out: {'{{check_out_time}}'} .
            </Typography>

            <Accordion sx={{ mt: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Welcome Message</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <TextField
                  fullWidth
                  label="Welcome Message Template"
                  multiline
                  rows={4}
                  value={templates.welcome_message}
                  onChange={(e) => setTemplates({ ...templates, welcome_message: e.target.value })}
                  onBlur={(e) => handleSaveTemplate('welcome_message', e.target.value)}
                  margin="normal"
                />
                <Box mt={2}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => resetToDefault('welcome_message')}
                  >
                    Reset to Default
                  </Button>
                </Box>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Farewell Message</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <TextField
                  fullWidth
                  label="Farewell Message Template"
                  multiline
                  rows={4}
                  value={templates.farewell_message}
                  onChange={(e) => setTemplates({ ...templates, farewell_message: e.target.value })}
                  onBlur={(e) => handleSaveTemplate('farewell_message', e.target.value)}
                  margin="normal"
                />
                <Box mt={2}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => resetToDefault('farewell_message')}
                  >
                    Reset to Default
                  </Button>
                </Box>
              </AccordionDetails>
            </Accordion>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

// Security Tab
const SecurityTab = ({ settings, onSave, onSnackbar, saving }) => {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Security Settings
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.require_device_approval || true}
                  onChange={(e) => onSave('require_device_approval', e.target.checked)}
                />
              }
              label="Require manual device approval"
              sx={{ display: 'block' }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.log_all_actions || true}
                  onChange={(e) => onSave('log_all_actions', e.target.checked)}
                />
              }
              label="Log all admin actions"
              sx={{ display: 'block' }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enable_api_rate_limiting || true}
                  onChange={(e) => onSave('enable_api_rate_limiting', e.target.checked)}
                />
              }
              label="Enable API rate limiting"
              sx={{ display: 'block' }}
            />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

// User Dialog Component
const UserDialog = ({ open, user, currentUser, onClose, onSave, onSnackbar }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        password: '',
        role: user.role || 'admin'
      });
    } else {
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'admin'
      });
    }
  }, [user]);

  const handleSave = async () => {
    if (!formData.email.trim()) {
      onSnackbar('Email is required', 'error');
      return;
    }

    if (!user && !formData.password) {
      onSnackbar('Password is required for new users', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const url = user ? `/api/settings/users/${user.id}` : '/api/settings/users';
      const method = user ? 'put' : 'post';
      
      const submitData = { ...formData };
      if (user && !formData.password) {
        delete submitData.password; // Don't send empty password for updates
      }

      await axios[method](url, submitData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      onSave();
      onSnackbar(`User ${user ? 'updated' : 'created'} successfully`, 'success');
      onClose();
    } catch (err) {
      onSnackbar(`Failed to ${user ? 'update' : 'create'} user`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const canEditRole = currentUser.role === 'super_admin' && (!user || user.id !== currentUser.id);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{user ? 'Edit User' : 'Add New User'}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          margin="dense"
        />
        <TextField
          fullWidth
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          margin="dense"
          required
        />
        <TextField
          fullWidth
          label={user ? 'New Password (leave empty to keep current)' : 'Password'}
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          margin="dense"
          required={!user}
        />
        {canEditRole && (
          <FormControl fullWidth margin="dense">
            <InputLabel>Role</InputLabel>
            <Select
              value={formData.role}
              label="Role"
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="super_admin">Super Admin</MenuItem>
            </Select>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={submitting}
        >
          {submitting ? 'Saving...' : (user ? 'Update User' : 'Create User')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsPage;
