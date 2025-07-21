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
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PowerSettingsNew as RebootIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Settings as ConfigIcon,
  Visibility as ViewIcon,
  CloudSync as SyncIcon,
  FilterList as FilterIcon,
  CheckCircle,
  Cancel,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const DevicesPage = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [filterStatus, setFilterStatus] = useState('all');
  const [approvalDialog, setApprovalDialog] = useState({ open: false, device: null });
  const [editDialog, setEditDialog] = useState({ open: false, device: null });
  const [configDialog, setConfigDialog] = useState({ open: false, device: null });
  const [bulkActionDialog, setBulkActionDialog] = useState({ open: false, action: null });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const { socket, connected } = useSocket();
  const { user } = useAuth();

  // Device status options
  const deviceStatuses = [
    { value: 'pending', label: 'Pending Approval', color: 'warning' },
    { value: 'approved', label: 'Approved', color: 'success' },
    { value: 'active', label: 'Active', color: 'primary' },
    { value: 'inactive', label: 'Inactive', color: 'default' },
    { value: 'rejected', label: 'Rejected', color: 'error' },
    { value: 'maintenance', label: 'Maintenance', color: 'info' },
  ];

  // Tab labels
  const tabLabels = ['All Devices', 'Pending Approval', 'Active', 'Offline'];

  useEffect(() => {
    fetchDevices();
    
    // Socket event listeners for real-time updates
    if (socket) {
      socket.on('device:new-registration', handleNewRegistration);
      socket.on('device:status-changed', handleStatusChanged);
      socket.on('device:heartbeat', handleHeartbeat);
      socket.on('device:config-updated', handleConfigUpdated);

      return () => {
        socket.off('device:new-registration');
        socket.off('device:status-changed');
        socket.off('device:heartbeat');
        socket.off('device:config-updated');
      };
    }
  }, [socket]);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/devices', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setDevices(response.data);
    } catch (err) {
      console.error('Error fetching devices:', err);
      setError('Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  // Real-time event handlers
  const handleNewRegistration = (data) => {
    setDevices(prev => [...prev, data.device]);
    showSnackbar(`New device registration: ${data.device.uuid}`, 'info');
  };

  const handleStatusChanged = (data) => {
    setDevices(prev => prev.map(device => 
      device.id === data.deviceId 
        ? { ...device, status: data.status, last_seen: new Date().toISOString() }
        : device
    ));
  };

  const handleHeartbeat = (data) => {
    setDevices(prev => prev.map(device => 
      device.id === data.deviceId 
        ? { ...device, last_seen: new Date().toISOString(), connection_status: 'online' }
        : device
    ));
  };

  const handleConfigUpdated = (data) => {
    setDevices(prev => prev.map(device => 
      device.id === data.deviceId 
        ? { ...device, ...data.updates }
        : device
    ));
    showSnackbar(`Device configuration updated: ${data.deviceId}`, 'success');
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleApproveDevice = async (device) => {
    setApprovalDialog({ open: true, device });
  };

  const handleRejectDevice = async (deviceId) => {
    try {
      await axios.post(`/api/devices/${deviceId}/reject`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchDevices();
      showSnackbar('Device rejected', 'warning');
    } catch (err) {
      showSnackbar('Failed to reject device', 'error');
    }
  };

  const handleRebootDevice = async (deviceId) => {
    try {
      await axios.post(`/api/devices/${deviceId}/reboot`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      showSnackbar('Reboot command sent to device', 'success');
    } catch (err) {
      showSnackbar('Failed to send reboot command', 'error');
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    if (user.role !== 'super_admin') {
      showSnackbar('Only super admin can delete devices', 'error');
      return;
    }

    if (window.confirm('Are you sure you want to delete this device? This action cannot be undone.')) {
      try {
        await axios.delete(`/api/devices/${deviceId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        fetchDevices();
        showSnackbar('Device deleted', 'success');
      } catch (err) {
        showSnackbar('Failed to delete device', 'error');
      }
    }
  };

  const handlePushConfig = async (deviceId) => {
    try {
      await axios.post(`/api/devices/${deviceId}/push-config`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      showSnackbar('Configuration pushed to device', 'success');
    } catch (err) {
      showSnackbar('Failed to push configuration', 'error');
    }
  };

  // Filter devices based on active tab and status filter
  const getFilteredDevices = () => {
    let filtered = devices;

    // Apply tab filter
    switch (activeTab) {
      case 1: // Pending Approval
        filtered = devices.filter(device => device.status === 'pending');
        break;
      case 2: // Active
        filtered = devices.filter(device => device.status === 'active' || device.status === 'approved');
        break;
      case 3: // Offline
        filtered = devices.filter(device => device.connection_status === 'offline');
        break;
      default: // All Devices
        break;
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(device => device.status === filterStatus);
    }

    return filtered;
  };

  // DataGrid columns
  const columns = [
    {
      field: 'uuid',
      headerName: 'Device UUID',
      width: 180,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {params.value?.substring(0, 8)}...
        </Typography>
      ),
    },
    {
      field: 'mac_address',
      headerName: 'MAC Address',
      width: 140,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'room_number',
      headerName: 'Room',
      width: 100,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="bold">
          {params.value || 'Unassigned'}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => {
        const status = deviceStatuses.find(s => s.value === params.value);
        return (
          <Chip
            label={status?.label || params.value}
            color={status?.color || 'default'}
            size="small"
          />
        );
      },
    },
    {
      field: 'connection_status',
      headerName: 'Connection',
      width: 110,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={params.value === 'online' ? 'success' : 'error'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'last_seen',
      headerName: 'Last Seen',
      width: 160,
      renderCell: (params) => {
        if (!params.value) return 'Never';
        const date = new Date(params.value);
        return date.toLocaleString();
      },
    },
    {
      field: 'device_info',
      headerName: 'Device Info',
      width: 150,
      renderCell: (params) => (
        <Box>
          <Typography variant="caption" display="block">
            {params.row.device_info?.model || 'Unknown'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.device_info?.android_version || 'Unknown'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      sortable: false,
      renderCell: (params) => (
        <Box>
          {params.row.status === 'pending' && (
            <>
              <Tooltip title="Approve Device">
                <IconButton
                  size="small"
                  color="success"
                  onClick={() => handleApproveDevice(params.row)}
                >
                  <ApproveIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reject Device">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleRejectDevice(params.row.id)}
                >
                  <RejectIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
          {(params.row.status === 'active' || params.row.status === 'approved') && (
            <>
              <Tooltip title="Push Configuration">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => handlePushConfig(params.row.id)}
                >
                  <SyncIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reboot Device">
                <IconButton
                  size="small"
                  color="warning"
                  onClick={() => handleRebootDevice(params.row.id)}
                >
                  <RebootIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title="Edit Device">
            <IconButton
              size="small"
              onClick={() => setEditDialog({ open: true, device: params.row })}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          {user.role === 'super_admin' && (
            <Tooltip title="Delete Device">
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDeleteDevice(params.row.id)}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
  ];

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
          Device Management
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Chip
            icon={connected ? <CheckCircle /> : <Cancel />}
            label={connected ? 'Real-time Connected' : 'Real-time Disconnected'}
            color={connected ? 'success' : 'error'}
            variant="outlined"
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchDevices}
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
              {devices.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Devices
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h4" color="success.main">
              {devices.filter(d => d.connection_status === 'online').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Online Now
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h4" color="warning.main">
              {devices.filter(d => d.status === 'pending').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pending Approval
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h4" color="info.main">
              {devices.filter(d => d.status === 'active').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active Devices
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Tabs and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
              {tabLabels.map((label, index) => (
                <Tab key={index} label={label} />
              ))}
            </Tabs>
            
            <Box display="flex" gap={2}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Status Filter</InputLabel>
                <Select
                  value={filterStatus}
                  label="Status Filter"
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  {deviceStatuses.map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {selectedDevices.length > 0 && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => setBulkActionDialog({ open: true, action: 'bulk' })}
                >
                  Bulk Actions ({selectedDevices.length})
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Devices Data Grid */}
      <Card>
        <DataGrid
          rows={getFilteredDevices().map(device => ({
            ...device,
            id: device._id || device.id
          }))}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10, 25, 50]}
          checkboxSelection
          disableSelectionOnClick
          autoHeight
          onSelectionModelChange={(newSelection) => setSelectedDevices(newSelection)}
          sx={{ border: 0 }}
        />
      </Card>

      {/* Device Approval Dialog */}
      <DeviceApprovalDialog
        open={approvalDialog.open}
        device={approvalDialog.device}
        onClose={() => setApprovalDialog({ open: false, device: null })}
        onApprove={fetchDevices}
        onSnackbar={showSnackbar}
      />

      {/* Device Edit Dialog */}
      <DeviceEditDialog
        open={editDialog.open}
        device={editDialog.device}
        onClose={() => setEditDialog({ open: false, device: null })}
        onSave={fetchDevices}
        onSnackbar={showSnackbar}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
};

// Device Approval Dialog Component
const DeviceApprovalDialog = ({ open, device, onClose, onApprove, onSnackbar }) => {
  const [roomNumber, setRoomNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleApprove = async () => {
    if (!roomNumber.trim()) {
      onSnackbar('Room number is required', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await axios.post(`/api/devices/${device.id}/approve`, {
        roomNumber: roomNumber.trim()
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      onApprove();
      onSnackbar(`Device approved and assigned to room ${roomNumber}`, 'success');
      onClose();
      setRoomNumber('');
    } catch (err) {
      onSnackbar('Failed to approve device', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Approve Device Registration</DialogTitle>
      <DialogContent>
        {device && (
          <Box mt={2}>
            <Typography variant="body2" gutterBottom>
              <strong>Device UUID:</strong> {device.uuid}
            </Typography>
            <Typography variant="body2" gutterBottom>
              <strong>MAC Address:</strong> {device.mac_address}
            </Typography>
            <Typography variant="body2" gutterBottom>
              <strong>Model:</strong> {device.device_info?.model || 'Unknown'}
            </Typography>
            <Typography variant="body2" gutterBottom>
              <strong>Android Version:</strong> {device.device_info?.android_version || 'Unknown'}
            </Typography>
            
            <TextField
              autoFocus
              margin="dense"
              label="Room Number"
              type="text"
              fullWidth
              variant="outlined"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              sx={{ mt: 2 }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleApprove} 
          variant="contained"
          disabled={submitting || !roomNumber.trim()}
        >
          {submitting ? 'Approving...' : 'Approve Device'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Device Edit Dialog Component
const DeviceEditDialog = ({ open, device, onClose, onSave, onSnackbar }) => {
  const [formData, setFormData] = useState({
    roomNumber: '',
    status: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (device) {
      setFormData({
        roomNumber: device.roomNumber || '',
        status: device.status || '',
        notes: device.notes || ''
      });
    }
  }, [device]);

  const handleSave = async () => {
    try {
      setSubmitting(true);
      await axios.put(`/api/devices/${device.id}`, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      onSave();
      onSnackbar('Device updated successfully', 'success');
      onClose();
    } catch (err) {
      onSnackbar('Failed to update device', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Device</DialogTitle>
      <DialogContent>
        <TextField
          margin="dense"
          label="Room Number"
          type="text"
          fullWidth
          variant="outlined"
          value={formData.roomNumber}
          onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
        />
        <FormControl fullWidth margin="dense">
          <InputLabel>Status</InputLabel>
          <Select
            value={formData.status}
            label="Status"
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <MenuItem value="pending">Pending Approval</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
            <MenuItem value="maintenance">Maintenance</MenuItem>
          </Select>
        </FormControl>
        <TextField
          margin="dense"
          label="Notes"
          multiline
          rows={3}
          fullWidth
          variant="outlined"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={submitting}
        >
          {submitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DevicesPage;
