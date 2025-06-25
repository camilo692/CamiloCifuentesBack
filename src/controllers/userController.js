const User = require('../models/User');
const jwt = require('jsonwebtoken');

const userController = {
  // Get all users (admin only)
  getAllUsers: async (req, res) => {
    try {
      const users = await User.find().select('-password');
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get user by ID (admin only)
  getUserById: async (req, res) => {
    try {
      const user = await User.findById(req.params.id).select('-password');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Create new user (register)
  createUser: async (req, res) => {
    try {
      const { name, email, password } = req.body;
      const user = new User({ name, email, password });
      const newUser = await user.save();
      
      // Generate token
      const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
      });

      res.status(201).json({
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        token
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Update user (admin only)
  updateUser: async (req, res) => {
    try {
      const { name, email, role } = req.body;
      const user = await User.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (name) user.name = name;
      if (email) user.email = email;
      if (role) user.role = role;

      const updatedUser = await user.save();
      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Delete user (admin only)
  deleteUser: async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      await user.deleteOne();
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get user profile (authenticated user)
  getProfile: async (req, res) => {
    try {
      const user = await User.findById(req.user._id).select('-password');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Update user profile (authenticated user)
  updateProfile: async (req, res) => {
    try {
      const { name, email } = req.body;
      const user = await User.findById(req.user._id);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (name) user.name = name;
      if (email) user.email = email;

      const updatedUser = await user.save();
      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
};

module.exports = userController; 