const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authOrMfaSetup = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose && decoded.purpose !== 'mfa_setup') {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    const user = await User.findById(decoded.id).select('+mfaSecret');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    req.mfaSetup = decoded.purpose === 'mfa_setup';
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = authOrMfaSetup;
