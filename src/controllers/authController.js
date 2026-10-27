const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');

const MAX_LOGIN_ATTEMPTS = 8;
const LOCK_MS = 15 * 60 * 1000;

const generateToken = (id, extra = {}, expiresIn = '8h') => {
  return jwt.sign({ id, ...extra }, process.env.JWT_SECRET, {
    expiresIn,
  });
};

const isMfaRequired = () => process.env.MFA_REQUIRED === 'true';

const publicUser = (user, token) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  mfaEnabled: Boolean(user.mfaEnabled),
  token,
});

const authController = {
  register: async (req, res) => {
    try {
      const { name, email, password } = req.body;

      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const user = await User.create({
        name,
        email,
        password,
      });

      const token = generateToken(user._id);

      res.status(201).json(publicUser(user, token));
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  login: async (req, res) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      const mfaCode = String(req.body.mfaCode || '').replace(/\s/g, '');

      const user = await User.findOne({ email }).select(
        '+password +mfaSecret +failedLoginAttempts +lockUntil'
      );
      if (!user) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
        return res.status(429).json({
          message: 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.',
        });
      }

      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        const attempts = (user.failedLoginAttempts || 0) + 1;
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
          await User.updateOne(
            { _id: user._id },
            { $set: { failedLoginAttempts: 0, lockUntil: new Date(Date.now() + LOCK_MS) } }
          );
        } else {
          await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: attempts } });
        }
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      if (user.mfaEnabled) {
        if (!mfaCode) {
          return res.json({ mfaRequired: true });
        }
        const validMfa = speakeasy.totp.verify({
          secret: user.mfaSecret,
          encoding: 'base32',
          token: mfaCode,
          window: 1,
        });
        if (!validMfa) {
          const attempts = (user.failedLoginAttempts || 0) + 1;
          if (attempts >= MAX_LOGIN_ATTEMPTS) {
            await User.updateOne(
              { _id: user._id },
              { $set: { failedLoginAttempts: 0, lockUntil: new Date(Date.now() + LOCK_MS) } }
            );
          } else {
            await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: attempts } });
          }
          return res.status(401).json({ message: 'Código MFA inválido' });
        }
      } else if (isMfaRequired() && user.role === 'admin') {
        const setupToken = generateToken(user._id, { purpose: 'mfa_setup' }, '10m');
        return res.json({
          mfaSetupRequired: true,
          setupToken,
          email: user.email,
        });
      }

      await User.updateOne(
        { _id: user._id },
        { $set: { failedLoginAttempts: 0, lockUntil: null } }
      );

      res.json(publicUser(user, generateToken(user._id)));
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  setupMfa: async (req, res) => {
    try {
      const user = req.user;
      if (user.mfaEnabled && !req.mfaSetup) {
        return res.status(400).json({ message: 'MFA ya está activo en esta cuenta.' });
      }

      const generated = speakeasy.generateSecret({
        length: 20,
        name: `Camilo Cifuentes (${user.email})`,
      });

      user.mfaSecret = generated.base32;
      user.mfaEnabled = false;
      await user.save();

      const qrDataUrl = await qrcode.toDataURL(generated.otpauth_url);
      res.json({
        qrDataUrl,
        otpauthUrl: generated.otpauth_url,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  enableMfa: async (req, res) => {
    try {
      const code = String(req.body.code || '').replace(/\s/g, '');
      const user = await User.findById(req.user._id).select('+mfaSecret');
      if (!user?.mfaSecret) {
        return res.status(400).json({ message: 'Primero genera el código QR de MFA.' });
      }

      const validMfa = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: code,
        window: 1,
      });
      if (!validMfa) {
        return res.status(401).json({ message: 'Código MFA inválido' });
      }

      user.mfaEnabled = true;
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();

      res.json(publicUser(user, generateToken(user._id)));
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  getProfile: async (req, res) => {
    try {
      const user = await User.findById(req.user._id);
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        mfaEnabled: Boolean(user.mfaEnabled),
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
};

module.exports = authController;
