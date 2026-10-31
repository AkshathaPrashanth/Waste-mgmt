require('dotenv').config();
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

// Default admin credentials (for demo - should be in env)
const ADMIN_USERS = {
    'admin@ecotrack.com': bcryptjs.hashSync('admin@123', 10),
    'supervisor@ecotrack.com': bcryptjs.hashSync('supervisor@123', 10)
};

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';
const TOKEN_EXPIRY = '24h';

// Generate JWT token
const generateToken = (adminId, role = 'admin') => {
    return jwt.sign(
        { adminId, role, timestamp: Date.now() },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
    );
};

// Verify JWT token
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

// Authenticate admin login
const authenticateAdmin = (email, password) => {
    if (!ADMIN_USERS[email]) {
        return { success: false, message: 'Admin user not found' };
    }
    
    const passwordMatch = bcryptjs.compareSync(password, ADMIN_USERS[email]);
    if (!passwordMatch) {
        return { success: false, message: 'Invalid password' };
    }
    
    const token = generateToken(email, 'admin');
    return {
        success: true,
        token,
        admin: {
            email,
            role: 'admin',
            expiresIn: TOKEN_EXPIRY
        }
    };
};

// Middleware to verify admin token
const verifyAdminToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    req.admin = decoded;
    next();
};

module.exports = {
    generateToken,
    verifyToken,
    authenticateAdmin,
    verifyAdminToken,
    JWT_SECRET,
    ADMIN_USERS
};
