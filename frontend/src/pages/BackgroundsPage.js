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
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  Visibility as PreviewIcon,
  Assignment as AssignIcon,
  Folder as BundleIcon,
  Image as ImageIcon,
  VideoFile as VideoIcon,
  Close as CloseIcon,
  CheckCircle,
  Cancel,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const BackgroundsPage = () => {
  const [backgrounds, setBackgrounds] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedBackgrounds, setSelectedBackgrounds] = useState([]);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [bundleDialog, setBundleDialog] = useState({ open: false, bundle: null });
  const [assignDialog, setAssignDialog] = useState({ open: false, bundle: null });
  const [previewDialog, setPreviewDialog] = useState({ open: false, item: null });
  const [editDialog, setEditDialog] = useState({ open: false, item: null });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { socket, connected } = useSocket();
  const { user } = useAuth();

  // Tab labels
  const tabLabels = ['All Backgrounds', 'Bundles', 'Assignments'];

  useEffect(() => {
    fetchData();
    
    // Socket event listeners for real-time updates
    if (socket) {
      socket.on('background:uploaded', handleBackgroundUploaded);
      socket.on('background:bundle-created', handleBundleCreated);
      socket.on('background:bundle-assigned', handleBundleAssigned);

      return () => {
        socket.off('background:uploaded');
        socket.off('background:bundle-created');
        socket.off('background:bundle-assigned');
      };
    }
  }, [socket]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [backgroundsRes, bundlesRes, devicesRes] = await Promise.all([
        axios.get('/api/backgrounds', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        axios.get('/api/backgrounds/bundles', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        axios.get('/api/devices', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      setBackgrounds(backgroundsRes.data);
      setBundles(bundlesRes.data);
      setDevices(devicesRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Real-time event handlers
  const handleBackgroundUploaded = (data) => {
    setBackgrounds(prev => [...prev, data.background]);
    showSnackbar(`Background uploaded: ${data.background.name}`, 'success');
  };

  const handleBundleCreated = (data) => {
    setBundles(prev => [...prev, data.bundle]);
    showSnackbar(`Bundle created: ${data.bundle.name}`, 'success');
  };

  const handleBundleAssigned = (data) => {
    showSnackbar(`Bundle assigned to ${data.assignments.length} target(s)`, 'success');
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // File upload with dropzone
  const onDrop = async (acceptedFiles) => {
    const formData = new FormData();
    
    acceptedFiles.forEach((file) => {
      formData.append('background', file);
    });

    try {
      setUploading(true);
      setUploadProgress(0);
      
      const response = await axios.post('/api/backgrounds/upload', formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      setBackgrounds(prev => [...prev, ...response.data.backgrounds]);
      showSnackbar(`${response.data.backgrounds.length} background(s) uploaded successfully`, 'success');
      setUploadDialog(false);
    } catch (err) {
      showSnackbar('Failed to upload backgrounds', 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      'video/*': ['.mp4', '.avi', '.mkv', '.webm']
    },
    multiple: true
  });

  const handleDeleteBackground = async (backgroundId) => {
    if (window.confirm('Are you sure you want to delete this background?')) {
      try {
        await axios.delete(`/api/backgrounds/${backgroundId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setBackgrounds(prev => prev.filter(bg => bg.id !== backgroundId));
        showSnackbar('Background deleted', 'success');
      } catch (err) {
        showSnackbar('Failed to delete background', 'error');
      }
    }
  };

  const handleDeleteBundle = async (bundleId) => {
    if (window.confirm('Are you sure you want to delete this bundle?')) {
      try {
        await axios.delete(`/api/backgrounds/bundles/${bundleId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setBundles(prev => prev.filter(bundle => bundle.id !== bundleId));
        showSnackbar('Bundle deleted', 'success');
      } catch (err) {
        showSnackbar('Failed to delete bundle', 'error');
      }
    }
  };

  const getFileIcon = (type) => {
    return type?.startsWith('video') ? <VideoIcon /> : <ImageIcon />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
          Background Library
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
            startIcon={<UploadIcon />}
            onClick={() => setUploadDialog(true)}
          >
            Upload Backgrounds
          </Button>
          <Button
            variant="outlined"
            startIcon={<BundleIcon />}
            onClick={() => setBundleDialog({ open: true, bundle: null })}
          >
            Create Bundle
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
              {backgrounds.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Backgrounds
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h4" color="success.main">
              {backgrounds.filter(bg => bg.type?.startsWith('image')).length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Images
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h4" color="info.main">
              {backgrounds.filter(bg => bg.type?.startsWith('video')).length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Videos
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h4" color="warning.main">
              {bundles.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Bundles
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
            
            {selectedBackgrounds.length > 0 && activeTab === 0 && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<BundleIcon />}
                onClick={() => setBundleDialog({ open: true, bundle: null, selectedItems: selectedBackgrounds })}
              >
                Create Bundle ({selectedBackgrounds.length})
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Tab Content */}
      {activeTab === 0 && (
        <BackgroundsTab
          backgrounds={backgrounds}
          selectedBackgrounds={selectedBackgrounds}
          setSelectedBackgrounds={setSelectedBackgrounds}
          onDelete={handleDeleteBackground}
          onPreview={(item) => setPreviewDialog({ open: true, item })}
          onEdit={(item) => setEditDialog({ open: true, item })}
        />
      )}

      {activeTab === 1 && (
        <BundlesTab
          bundles={bundles}
          backgrounds={backgrounds}
          onDelete={handleDeleteBundle}
          onEdit={(bundle) => setBundleDialog({ open: true, bundle })}
          onAssign={(bundle) => setAssignDialog({ open: true, bundle })}
          onPreview={(item) => setPreviewDialog({ open: true, item })}
        />
      )}

      {activeTab === 2 && (
        <AssignmentsTab
          bundles={bundles}
          devices={devices}
          onRefresh={fetchData}
        />
      )}

      {/* Upload Dialog */}
      <UploadDialog
        open={uploadDialog}
        onClose={() => setUploadDialog(false)}
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        uploading={uploading}
        uploadProgress={uploadProgress}
      />

      {/* Bundle Dialog */}
      <BundleDialog
        open={bundleDialog.open}
        bundle={bundleDialog.bundle}
        selectedItems={bundleDialog.selectedItems}
        backgrounds={backgrounds}
        onClose={() => setBundleDialog({ open: false, bundle: null })}
        onSave={fetchData}
        onSnackbar={showSnackbar}
      />

      {/* Assignment Dialog */}
      <AssignmentDialog
        open={assignDialog.open}
        bundle={assignDialog.bundle}
        devices={devices}
        onClose={() => setAssignDialog({ open: false, bundle: null })}
        onAssign={fetchData}
        onSnackbar={showSnackbar}
      />

      {/* Preview Dialog */}
      <PreviewDialog
        open={previewDialog.open}
        item={previewDialog.item}
        onClose={() => setPreviewDialog({ open: false, item: null })}
      />

      {/* Edit Dialog */}
      <EditBackgroundDialog
        open={editDialog.open}
        item={editDialog.item}
        onClose={() => setEditDialog({ open: false, item: null })}
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

// Backgrounds Tab Component
const BackgroundsTab = ({ backgrounds, selectedBackgrounds, setSelectedBackgrounds, onDelete, onPreview, onEdit }) => {
  const handleSelectBackground = (backgroundId) => {
    setSelectedBackgrounds(prev => 
      prev.includes(backgroundId)
        ? prev.filter(id => id !== backgroundId)
        : [...prev, backgroundId]
    );
  };

  const getFileIcon = (type) => {
    return type?.startsWith('video') ? <VideoIcon /> : <ImageIcon />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (backgrounds.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box textAlign="center" py={4}>
            <ImageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No backgrounds uploaded yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upload some images or videos to get started
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <ImageList variant="masonry" cols={4} gap={16}>
        {backgrounds.map((background) => (
          <ImageListItem key={background.id}>
            <Box
              sx={{
                position: 'relative',
                cursor: 'pointer',
                border: selectedBackgrounds.includes(background.id) ? 2 : 0,
                borderColor: 'primary.main',
                borderRadius: 1,
                overflow: 'hidden'
              }}
              onClick={() => handleSelectBackground(background.id)}
            >
              {background.type?.startsWith('image') ? (
                <img
                  src={background.url}
                  alt={background.name}
                  loading="lazy"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              ) : (
                <Box
                  sx={{
                    width: '100%',
                    height: 200,
                    backgroundColor: 'grey.200',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}
                >
                  <VideoIcon sx={{ fontSize: 48, color: 'grey.500' }} />
                  <PlayIcon
                    sx={{
                      position: 'absolute',
                      fontSize: 32,
                      color: 'primary.main'
                    }}
                  />
                </Box>
              )}
              
              <Checkbox
                checked={selectedBackgrounds.includes(background.id)}
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)'
                }}
              />
            </Box>
            
            <ImageListItemBar
              title={background.name}
              subtitle={`${background.type?.startsWith('video') ? 'Video' : 'Image'} • ${formatFileSize(background.size)}`}
              actionIcon={
                <Box>
                  <Tooltip title="Preview">
                    <IconButton
                      size="small"
                      sx={{ color: 'rgba(255, 255, 255, 0.8)' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreview(background);
                      }}
                    >
                      <PreviewIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      sx={{ color: 'rgba(255, 255, 255, 0.8)' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(background);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      sx={{ color: 'rgba(255, 255, 255, 0.8)' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(background.id);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              }
            />
          </ImageListItem>
        ))}
      </ImageList>
    </Card>
  );
};

// Bundles Tab Component
const BundlesTab = ({ bundles, backgrounds, onDelete, onEdit, onAssign, onPreview }) => {
  if (bundles.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box textAlign="center" py={4}>
            <BundleIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No bundles created yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create bundles to group backgrounds together
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Grid container spacing={3}>
      {bundles.map((bundle) => (
        <Grid item xs={12} sm={6} md={4} key={bundle.id}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Typography variant="h6" gutterBottom>
                  {bundle.name}
                </Typography>
                <Box>
                  <Tooltip title="Assign to Devices">
                    <IconButton size="small" onClick={() => onAssign(bundle)}>
                      <AssignIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit Bundle">
                    <IconButton size="small" onClick={() => onEdit(bundle)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Bundle">
                    <IconButton size="small" color="error" onClick={() => onDelete(bundle.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              
              {bundle.description && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {bundle.description}
                </Typography>
              )}
              
              <Typography variant="body2" gutterBottom>
                {bundle.backgrounds?.length || 0} background(s)
              </Typography>

              {/* Preview thumbnails */}
              <Box display="flex" flexWrap="wrap" gap={1} mt={2}>
                {bundle.backgrounds?.slice(0, 6).map((bg) => (
                  <Box
                    key={bg.id}
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1,
                      overflow: 'hidden',
                      cursor: 'pointer'
                    }}
                    onClick={() => onPreview(bg)}
                  >
                    {bg.type?.startsWith('image') ? (
                      <img
                        src={bg.url}
                        alt={bg.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: '100%',
                          height: '100%',
                          backgroundColor: 'grey.200',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <VideoIcon sx={{ fontSize: 16, color: 'grey.500' }} />
                      </Box>
                    )}
                  </Box>
                ))}
                {bundle.backgrounds?.length > 6 && (
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1,
                      backgroundColor: 'grey.100',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Typography variant="caption">
                      +{bundle.backgrounds.length - 6}
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

// Assignments Tab Component
const AssignmentsTab = ({ bundles, devices, onRefresh }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Bundle Assignments
        </Typography>
        <List>
          {devices.filter(device => device.assigned_bundle).map((device) => {
            const bundle = bundles.find(b => b.id === device.assigned_bundle);
            return (
              <ListItem key={device.id}>
                <ListItemAvatar>
                  <Avatar>
                    {device.room_number || '?'}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={`Room ${device.room_number || 'Unassigned'}`}
                  secondary={bundle ? `Bundle: ${bundle.name}` : 'No bundle assigned'}
                />
                <Chip
                  label={device.status}
                  color={device.status === 'active' ? 'success' : 'default'}
                  size="small"
                />
              </ListItem>
            );
          })}
        </List>
      </CardContent>
    </Card>
  );
};

// Upload Dialog Component
const UploadDialog = ({ open, onClose, getRootProps, getInputProps, isDragActive, uploading, uploadProgress }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Backgrounds</DialogTitle>
      <DialogContent>
        <Box
          {...getRootProps()}
          sx={{
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.300',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
            '&:hover': {
              backgroundColor: 'action.hover',
              borderColor: 'primary.main'
            }
          }}
        >
          <input {...getInputProps()} />
          <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {isDragActive ? 'Drop the files here' : 'Drag & drop files here'}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            or click to select files
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Supports: JPG, PNG, GIF, WebP, MP4, AVI, MKV, WebM
          </Typography>
        </Box>

        {uploading && (
          <Box mt={3}>
            <Typography variant="body2" gutterBottom>
              Uploading... {uploadProgress}%
            </Typography>
            <LinearProgress variant="determinate" value={uploadProgress} />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={uploading}>
          {uploading ? 'Uploading...' : 'Cancel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Bundle Dialog Component
const BundleDialog = ({ open, bundle, selectedItems, backgrounds, onClose, onSave, onSnackbar }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    backgrounds: [],
    settings: {
      image_duration: 10,
      video_mode: 'full',
      shuffle: false,
      loop: true
    }
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (bundle) {
      setFormData({
        name: bundle.name || '',
        description: bundle.description || '',
        backgrounds: bundle.backgrounds?.map(bg => bg.id) || [],
        settings: {
          image_duration: bundle.settings?.image_duration || 10,
          video_mode: bundle.settings?.video_mode || 'full',
          shuffle: bundle.settings?.shuffle || false,
          loop: bundle.settings?.loop || true
        }
      });
    } else if (selectedItems) {
      setFormData(prev => ({
        ...prev,
        backgrounds: selectedItems
      }));
    }
  }, [bundle, selectedItems]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      onSnackbar('Bundle name is required', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const url = bundle ? `/api/backgrounds/bundles/${bundle.id}` : '/api/backgrounds/bundles';
      const method = bundle ? 'put' : 'post';
      
      await axios[method](url, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      onSave();
      onSnackbar(`Bundle ${bundle ? 'updated' : 'created'} successfully`, 'success');
      onClose();
    } catch (err) {
      onSnackbar(`Failed to ${bundle ? 'update' : 'create'} bundle`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{bundle ? 'Edit Bundle' : 'Create Bundle'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Bundle Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              margin="dense"
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
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Image Duration (seconds)"
              value={formData.settings.image_duration}
              onChange={(e) => setFormData({
                ...formData,
                settings: { ...formData.settings, image_duration: parseInt(e.target.value) }
              })}
              margin="dense"
            />
            <FormControl fullWidth margin="dense">
              <InputLabel>Video Mode</InputLabel>
              <Select
                value={formData.settings.video_mode}
                label="Video Mode"
                onChange={(e) => setFormData({
                  ...formData,
                  settings: { ...formData.settings, video_mode: e.target.value }
                })}
              >
                <MenuItem value="full">Play Full Video</MenuItem>
                <MenuItem value="timed">Play with Duration</MenuItem>
              </Select>
            </FormControl>
            
            <Box mt={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.settings.shuffle}
                    onChange={(e) => setFormData({
                      ...formData,
                      settings: { ...formData.settings, shuffle: e.target.checked }
                    })}
                  />
                }
                label="Shuffle Order"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.settings.loop}
                    onChange={(e) => setFormData({
                      ...formData,
                      settings: { ...formData.settings, loop: e.target.checked }
                    })}
                  />
                }
                label="Loop Playback"
              />
            </Box>
          </Grid>
          
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Select Backgrounds</InputLabel>
              <Select
                multiple
                value={formData.backgrounds}
                onChange={(e) => setFormData({ ...formData, backgrounds: e.target.value })}
                input={<OutlinedInput label="Select Backgrounds" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const bg = backgrounds.find(b => b.id === value);
                      return (
                        <Chip key={value} label={bg?.name || value} size="small" />
                      );
                    })}
                  </Box>
                )}
              >
                {backgrounds.map((bg) => (
                  <MenuItem key={bg.id} value={bg.id}>
                    <Checkbox checked={formData.backgrounds.indexOf(bg.id) > -1} />
                    <ListItemText primary={bg.name} secondary={bg.type} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
          {submitting ? 'Saving...' : (bundle ? 'Update Bundle' : 'Create Bundle')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Assignment Dialog Component
const AssignmentDialog = ({ open, bundle, devices, onClose, onAssign, onSnackbar }) => {
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleAssign = async () => {
    if (selectedDevices.length === 0) {
      onSnackbar('Please select at least one device', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await axios.post('/api/backgrounds/assign', {
        bundleId: bundle.id,
        deviceIds: selectedDevices
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      onAssign();
      onSnackbar(`Bundle assigned to ${selectedDevices.length} device(s)`, 'success');
      onClose();
      setSelectedDevices([]);
    } catch (err) {
      onSnackbar('Failed to assign bundle', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Assign Bundle: {bundle?.name}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Select devices to assign this background bundle to:
        </Typography>
        
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
            {devices.filter(device => device.status === 'active').map((device) => (
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
          {submitting ? 'Assigning...' : 'Assign Bundle'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Preview Dialog Component
const PreviewDialog = ({ open, item, onClose }) => {
  if (!item) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {item.name}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
          {item.type?.startsWith('image') ? (
            <img
              src={item.url}
              alt={item.name}
              style={{ maxWidth: '100%', maxHeight: '500px', objectFit: 'contain' }}
            />
          ) : (
            <video
              src={item.url}
              controls
              style={{ maxWidth: '100%', maxHeight: '500px' }}
            >
              Your browser does not support the video tag.
            </video>
          )}
        </Box>
        <Box mt={2}>
          <Typography variant="body2" color="text.secondary">
            <strong>Type:</strong> {item.type}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Size:</strong> {formatFileSize(item.size)}
          </Typography>
          {item.created_at && (
            <Typography variant="body2" color="text.secondary">
              <strong>Uploaded:</strong> {new Date(item.created_at).toLocaleString()}
            </Typography>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
  
  // Helper function for formatting file size
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};

// Edit Background Dialog Component
const EditBackgroundDialog = ({ open, item, onClose, onSave, onSnackbar }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        description: item.description || ''
      });
    }
  }, [item]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      onSnackbar('Background name is required', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await axios.put(`/api/backgrounds/${item.id}`, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      onSave();
      onSnackbar('Background updated successfully', 'success');
      onClose();
    } catch (err) {
      onSnackbar('Failed to update background', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Background</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Background Name"
          type="text"
          fullWidth
          variant="outlined"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <TextField
          margin="dense"
          label="Description"
          multiline
          rows={3}
          fullWidth
          variant="outlined"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
        
        {item && (
          <Box mt={2}>
            <Typography variant="body2" color="text.secondary">
              <strong>Type:</strong> {item.type}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Size:</strong> {formatFileSize(item.size)}
            </Typography>
          </Box>
        )}
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

export default BackgroundsPage;
