import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';

const JWT_SECRET = env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET environment variable is required');
  console.error('Please set JWT_SECRET in your .env file');
  process.exit(1);
}

export const authenticate = async (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    // Priority 1: Check Authorization header (Bearer token)
    // Priority 2: Fallback to httpOnly cookie for backward compatibility
    let token = null;
    
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '').trim();
    }
    
    // Fallback to cookie if no Authorization header
    if (!token) {
      token = req.cookies?.token;
    }
    
    if (!token || token === 'null' || token === 'undefined' || token === '') {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).populate('groupId');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    
    if (!user.groupId || !Array.isArray(user.groupId.permissions)) {
      return res.status(401).json({ error: 'Group has no permissions defined.' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    res.status(401).json({ error: 'Invalid token.' });
  }
};

export const isAdmin = (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    if (!req.user || !req.user.groupId || !Array.isArray(req.user.groupId.permissions)) {
      return res.status(403).json({ error: 'Access denied - insufficient privileges.' });
    }
    if (!req.user.groupId.permissions.includes('admin')) {
      return res.status(403).json({ error: 'Access denied - admin required.' });
    }
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(403).json({ error: 'Access denied.' });
  }
};

export const hasPermission = (permission) => {
  return (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      if (!req.user || !req.user.groupId || !Array.isArray(req.user.groupId.permissions)) {
        return res.status(403).json({ error: 'Access denied - insufficient privileges.' });
      }
      if (!req.user.groupId.permissions.includes(permission) && !req.user.groupId.permissions.includes('admin')) {
        return res.status(403).json({ error: 'Access denied - missing permission.' });
      }
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(403).json({ error: 'Access denied.' });
    }
  };
};