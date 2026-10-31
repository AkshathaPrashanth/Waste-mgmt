require('dotenv').config();
const { authenticateAdmin, verifyAdminToken } = require('./auth');
const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./firebase');
const { getLocalReply } = require('./chatbot');
const alerts = [];

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: db ? 'configured' : 'memory' });
});

// ===== ADMIN AUTHENTICATION & DASHBOARD =====

// Admin Login
app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    
    const result = authenticateAdmin(email, password);
    if (!result.success) {
        return res.status(401).json({ error: result.message });
    }
    
    res.json({ ...result, message: 'Login successful' });
});

// Protected Admin Dashboard
app.get('/api/admin/protected-dashboard', verifyAdminToken, async (req, res) => {
    try {
        let currentComplaints = (await listComplaints()).map(c => ({ ...c, votes: c.votes || 1 }));
        
        // Get ML recommendations
        let recommendations = [];
        try {
            const mlRes = await fetch('http://127.0.0.1:8000/get-recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    complaints: currentComplaints.map(c => ({
                        id: c.id,
                        location: c.location,
                        description: c.description,
                        votes: c.votes
                    }))
                })
            });
            const mlData = await mlRes.json();
            recommendations = mlData.recommendations || [];
        } catch (e) {
            recommendations = [...currentComplaints]
                .sort((a, b) => (b.votes || 1) - (a.votes || 1))
                .slice(0, 5)
                .map(c => ({ id: c.id, location: c.location, description: c.description, votes: c.votes, action: c.votes >= 3 ? 'Prioritize cleanup' : 'Monitor and schedule' }));
        }
        
        // Analytics
        const highRisk = currentComplaints.filter(c => c.riskLevel === 'High');
        const topComplaints = currentComplaints.sort((a, b) => (b.votes || 1) - (a.votes || 1)).slice(0, 10);
        
        res.json({
            admin: req.admin,
            summary: {
                total: currentComplaints.length,
                pending: currentComplaints.filter(c => c.status === 'Pending').length,
                in_progress: currentComplaints.filter(c => c.status === 'In Progress').length,
                resolved: currentComplaints.filter(c => c.status === 'Resolved').length,
                high_risk: highRisk.length
            },
            top_complaints: topComplaints,
            recommendations: recommendations.slice(0, 5),
            alerts: highRisk.map(c => ({
                id: c.id,
                description: c.description,
                priority: c.priorityScore,
                location: c.location,
                votes: c.votes || 1,
                timestamp: c.timestamp
            }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Dashboard fetch failed' });
    }
});

// Update complaint status (admin only)
app.patch('/api/admin/complaints/:id/status', verifyAdminToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['Pending', 'In Progress', 'Resolved'];
    
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    
    const complaint = complaints.find(c => c.id === id);
    if (!complaint) {
        return res.status(404).json({ error: 'Complaint not found' });
    }
    
    complaint.status = status;
    if (db) {
        await db.ref(`complaints/${id}`).update({ status });
    }
    
    res.json({ id, status, message: `Complaint updated to ${status}` });
});

// Send alert to municipality
app.post('/api/admin/send-alert', verifyAdminToken, async (req, res) => {
    const { clusterId, location, complaints_count } = req.body;
    
    try {
        const alertId = uuidv4();
        const alert = {
            id: alertId,
            clusterId,
            location,
            complaints_count,
            timestamp: new Date().toISOString(),
            status: 'Sent',
            sent_by: req.admin.adminId
        };
        
        if (db) {
            await db.ref(`alerts/${alertId}`).set(alert);
        } else {
            alerts.push(alert);
        }
        
        res.json({ success: true, alert_id: alertId, message: 'Alert sent to municipality' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send alert' });
    }
});

// In-memory mock data with clustered coordinates around Delhi for better grouping
let complaints = [
    {
        id: '1',
        userId: 'admin',
        imageUrl: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=500&q=80',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        location: { lat: 28.7041, lng: 77.1025 }, // Delhi
        status: 'Pending',
        riskLevel: 'High',
        priorityScore: 85,
        alertTrigger: 'Immediate Action Required',
        description: 'Large pile of garbage near the market area.',
        votes: 3
    },
    {
        id: '2',
        userId: 'admin',
        imageUrl: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=500&q=80',
        timestamp: new Date().toISOString(),
        location: { lat: 28.7050, lng: 77.1030 }, // Close to Delhi
        status: 'In Progress',
        riskLevel: 'High',
        priorityScore: 82,
        alertTrigger: 'Immediate Action Required',
        description: 'Construction debris blocking footpath.',
        votes: 1
    },
    {
        id: '3',
        userId: 'admin',
        imageUrl: 'https://images.unsplash.com/photo-1595278069441-2cf29f8005a4?w=500&q=80',
        timestamp: new Date().toISOString(),
        location: { lat: 28.5355, lng: 77.3910 }, // Noida
        status: 'Pending',
        riskLevel: 'Medium',
        priorityScore: 55,
        alertTrigger: 'Schedule Cleanup',
        description: 'Plastic waste scattered in park.',
        votes: 2
    },
    {
        id: '4',
        userId: 'system',
        imageUrl: '',
        timestamp: new Date().toISOString(),
        location: { lat: 28.5360, lng: 77.3920 }, // Close to Noida
        status: 'Resolved',
        riskLevel: 'Low',
        priorityScore: 25,
        alertTrigger: 'Routine Cleanup',
        description: 'Minor litter near street lamp.',
        votes: 1
    },
    {
        id: '5',
        userId: 'system',
        imageUrl: '',
        timestamp: new Date().toISOString(),
        location: { lat: 28.6139, lng: 77.2090 }, // Central Delhi
        status: 'Pending',
        riskLevel: 'High',
        priorityScore: 88,
        alertTrigger: 'Immediate Action Required',
        description: 'Overflowing dumpsters.',
        votes: 5
    }
];

const uploadDirectory = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });
const storage = multer.diskStorage({
    destination: uploadDirectory,
    filename: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        callback(null, `${uuidv4()}${extension}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
            return callback(new Error('Only JPG, PNG, and WebP images are supported.'));
        }
        callback(null, true);
    }
});

// Helper: Calculate distance between two coordinates in meters
const getDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Helper: Find nearby complaints within radius (meters)
const listComplaints = async () => {
    if (db) {
        try {
            const snapshot = await db.ref('complaints').once('value');
            const data = snapshot.val();
            return data ? Object.values(data) : [];
        } catch (error) {
            console.error('Firebase fetch error; using in-memory complaints:', error.message);
        }
    }
    return complaints;
};

const findNearbyComplaints = (lat, lng, radiusMeters = 150, source = complaints) => {
    const allComplaints = source.filter(c => c.status !== 'Resolved');
    return allComplaints.filter(complaint => {
        if (!Number.isFinite(complaint.location?.lat) || !Number.isFinite(complaint.location?.lng)) return false;
        const distance = getDistance(lat, lng, complaint.location.lat, complaint.location.lng);
        return distance <= radiusMeters;
    });
};

const buildFallbackClusters = (source) => {
    const active = source.filter(c => c.status !== 'Resolved' &&
        Number.isFinite(c.location?.lat) && Number.isFinite(c.location?.lng));
    const visited = new Set();
    const clusters = [];

    for (const complaint of active) {
        if (visited.has(complaint.id)) continue;
        const members = [];
        const queue = [complaint];
        visited.add(complaint.id);

        while (queue.length) {
            const current = queue.pop();
            members.push(current);
            for (const candidate of active) {
                if (visited.has(candidate.id)) continue;
                if (getDistance(current.location.lat, current.location.lng, candidate.location.lat, candidate.location.lng) <= 150) {
                    visited.add(candidate.id);
                    queue.push(candidate);
                }
            }
        }

        if (members.length > 1) {
            clusters.push({
                id: `spot-${complaint.id}`,
                location: {
                    lat: members.reduce((sum, item) => sum + item.location.lat, 0) / members.length,
                    lng: members.reduce((sum, item) => sum + item.location.lng, 0) / members.length
                },
                complaints_count: members.length,
                complaint_ids: members.map(item => item.id),
                risk_level: members.length >= 3 ? 'High' : 'Medium'
            });
        }
    }

    return clusters.sort((a, b) => b.complaints_count - a.complaints_count);
};

app.get('/api/complaints', async (req, res) => {
    const complaintsWithVotes = (await listComplaints()).map(c => ({ ...c, votes: c.votes || 1 }));
    res.json(complaintsWithVotes);
});

// Check for nearby complaints (prevent duplicates)
app.post('/api/complaints/check-nearby', async (req, res) => {
    const { lat, lng } = req.body;
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return res.status(400).json({ error: 'Valid latitude and longitude are required' });
    }
    
    const nearby = findNearbyComplaints(latitude, longitude, 150, await listComplaints());
    const nearbyWithVotes = nearby.map(c => ({ ...c, votes: c.votes || 1 }));
    if (nearbyWithVotes.length > 0) {
        return res.json({ 
            hasDuplicate: true, 
            nearby: nearbyWithVotes,
            message: `Found ${nearbyWithVotes.length} report(s) nearby. Please vote instead of creating a duplicate!` 
        });
    }
    res.json({ hasDuplicate: false, nearby: [] });
});

// Vote/Upvote on a complaint
app.post('/api/complaints/:id/vote', async (req, res) => {
    const { id } = req.params;
    if (db) {
        try {
            const result = await db.ref(`complaints/${id}`).transaction(current => {
                if (current) current.votes = (current.votes || 0) + 1;
                return current;
            });
            if (!result.committed || !result.snapshot.exists()) {
                return res.status(404).json({ error: 'Complaint not found' });
            }
            return res.json({ id, votes: result.snapshot.val().votes, message: 'Vote recorded! Thanks for confirming this spot.' });
        } catch (e) {
            console.error('Firebase vote update failed:', e.message);
            return res.status(500).json({ error: 'Vote could not be saved' });
        }
    }
    const complaint = complaints.find(c => c.id === id);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    complaint.votes = (complaint.votes || 0) + 1;
    res.json({ id, votes: complaint.votes, message: 'Vote recorded! Thanks for confirming this spot.' });
});

app.post('/api/complaints', upload.single('image'), async (req, res) => {
    try {
        const { lat, lng, description, userId } = req.body;
        const latitude = Number(lat);
        const longitude = Number(lng);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
            return res.status(400).json({ error: 'Valid latitude and longitude are required' });
        }
        if (typeof description !== 'string' || description.trim().length < 5 || description.trim().length > 500) {
            return res.status(400).json({ error: 'Description must be between 5 and 500 characters' });
        }
        const hasImage = Boolean(req.file);
        
        const newComplaint = {
            id: uuidv4(),
            userId: userId || 'anonymous',
            imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
            timestamp: new Date().toISOString(),
            location: { lat: latitude, lng: longitude },
            status: 'Pending',
            description: description.trim(),
            votes: 1
        };

        // Call ML Service synchronously for real-time risk
        try {
            const mlRes = await fetch('http://127.0.0.1:8000/predict-risk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: newComplaint.id,
                    location: newComplaint.location,
                    description: description || '',
                    hasImage
                })
            });
            if (!mlRes.ok) throw new Error(`ML service returned ${mlRes.status}`);
            const mlData = await mlRes.json();
            
            newComplaint.riskLevel = mlData.risk_level || 'Low';
            newComplaint.priorityScore = mlData.priority_score ?? 30;
            newComplaint.alertTrigger = mlData.alert_trigger || 'Routine Cleanup';
            newComplaint.confidence = mlData.confidence ?? 0.6;
            
        } catch (mlErr) {
            console.error("ML Service error:", mlErr);
            const text = newComplaint.description.toLowerCase();
            const highRisk = ['overflow', 'blocked', 'hazard', 'medical', 'construction'].some(word => text.includes(word));
            const mediumRisk = ['pile', 'dump', 'large', 'market', 'plastic', 'litter', 'waste', 'garbage'].some(word => text.includes(word));
            newComplaint.riskLevel = highRisk ? 'High' : mediumRisk ? 'Medium' : 'Low';
            newComplaint.priorityScore = highRisk ? 75 : mediumRisk ? 55 : 30;
            newComplaint.alertTrigger = highRisk ? 'Immediate Action Required' : mediumRisk ? 'Schedule Cleanup' : 'Routine Cleanup';
            newComplaint.confidence = 0.6;
        }

        if (db) {
            await db.ref(`complaints/${newComplaint.id}`).set(newComplaint);
            return res.status(201).json(newComplaint);
        }

        complaints.push(newComplaint);
        res.status(201).json(newComplaint);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create complaint' });
    }
});

app.patch('/api/complaints/:id/status', verifyAdminToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['Pending', 'In Progress', 'Resolved'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    
    if (db) {
        try {
            const ref = db.ref(`complaints/${id}`);
            const snapshot = await ref.once('value');
            if (!snapshot.exists()) return res.status(404).json({ error: 'Complaint not found' });
            await ref.update({ status });
            return res.json({ id, status });
        } catch (e) {
            console.error('Firebase status update failed:', e.message);
            return res.status(500).json({ error: 'Update failed' });
        }
    }

    const complaint = complaints.find(c => c.id === id);
    if (complaint) {
        complaint.status = status;
        res.json(complaint);
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

// Admin Dashboard Endpoints Support
app.post('/api/admin/alert', verifyAdminToken, async (req, res) => {
    try {
        const { clusterId, location, action, complaintsCount } = req.body;
        if (db) {
            const alertId = uuidv4();
            const alertData = {
                id: alertId,
                clusterId,
                location,
                action,
                complaintsCount,
                timestamp: new Date().toISOString(),
                status: 'Dispatched to Municipality'
            };
            await db.ref(`alerts/${alertId}`).set(alertData);
        } else {
            alerts.push(alertData);
        }
        return res.status(200).json({ success: true, alert_id: alertId, message: 'Alert successfully recorded for the municipality.' });
    } catch (e) {
        console.error('Alert error:', e);
        res.status(500).json({ error: 'Failed to send alert' });
    }
});

app.get('/api/admin/dashboard', async (req, res) => {
    try {
        const currentComplaints = await listComplaints();
        const total = currentComplaints.length;
        const pending = currentComplaints.filter(c => c.status === 'Pending').length;
        const resolved = currentComplaints.filter(c => c.status === 'Resolved').length;
        let clusters = [];
        try {
            const mlRes = await fetch('http://127.0.0.1:8000/detect-blackspots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    complaints: currentComplaints.map(c => ({
                        id: c.id,
                        location: c.location,
                        description: c.description
                    }))
                })
            });
            if (!mlRes.ok) throw new Error(`ML service returned ${mlRes.status}`);
            const mlData = await mlRes.json();
            clusters = mlData.clusters || [];
            if (db && clusters.length > 0) await db.ref('blackspots').set(clusters);
        } catch (mlErr) {
            clusters = buildFallbackClusters(currentComplaints);
            if (db) {
                try {
                    await db.ref('blackspots').set(clusters);
                } catch (dbError) {
                    console.error('Firebase blackspot save failed:', dbError.message);
                }
            }
        }
        return res.json({ stats: { total, pending, in_progress: currentComplaints.filter(c => c.status === 'In Progress').length, resolved, high_risk: currentComplaints.filter(c => c.riskLevel === 'High' && c.status !== 'Resolved').length }, topClusters: clusters });
    } catch (error) {
        console.error('Dashboard fetch failed:', error.message);
        return res.status(500).json({ error: 'Dashboard fetch failed' });
    }
});

// Mock Analytics
app.get('/api/analytics', async (req, res) => {
    const currentComplaints = await listComplaints();
    const total = currentComplaints.length;
    const pending = currentComplaints.filter(c => c.status === 'Pending').length;
    const resolved = currentComplaints.filter(c => c.status === 'Resolved').length;
    res.json({ total, pending, resolved });
});

// Chatbot Endpoint
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy");
app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'At least one chat message is required' });
        }

        const latestMessage = messages[messages.length - 1];
        if (latestMessage?.sender !== 'user' || typeof latestMessage.text !== 'string' || !latestMessage.text.trim() || latestMessage.text.length > 1000) {
            return res.status(400).json({ error: 'The latest message must be a non-empty user message of at most 1000 characters' });
        }

        const localReply = getLocalReply(latestMessage.text);
        if (localReply) return res.json({ reply: localReply, source: 'local' });

        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'paste_your_api_key_here') {
            return res.json({
                reply: "I can answer questions about reporting waste, photos, voting, report statuses, risk levels, the heatmap, admin access, and waste sorting. Try asking me about one of those topics!",
                source: 'local'
            });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        // Format history for Gemini
        const history = messages.slice(-11, -1).filter(m => m && typeof m.text === 'string').map(m => ({
            role: m.sender === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
        }));
        
        const chat = model.startChat({
            history: history,
            systemInstruction: "You are Binny, the friendly and helpful chatbot assistant for EcoTrack (a Smart Waste Management system). Your job is to help users report garbage hotspots, understand risk levels, and guide them on how to use the dashboard. Keep your answers concise, friendly, and use emojis."
        });

        const result = await chat.sendMessage(latestMessage.text);
        const response = await result.response;
        const text = response.text();

        res.json({ reply: text, source: 'gemini' });
    } catch (error) {
        console.error("Chat API error:", error);
        res.status(500).json({ error: "Failed to communicate with AI" });
    }
});

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});

app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
            error: error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : error.message
        });
    }
    if (error) {
        console.error('Request failed:', error.message);
        return res.status(400).json({ error: error.message || 'Invalid request' });
    }
    next();
});
