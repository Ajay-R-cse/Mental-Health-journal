import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userRepository } from '../repositories/UserRepository.js';
import { User } from '../models/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'mental-health-journal-secure-jwt-secret-key-2026';

export class AuthService {
  generateToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  async register(data: { name: string; email: string; password: string; confirmPassword?: string }): Promise<{ user: Omit<User, 'password_hash'>; token: string }> {
    const { name, email, password, confirmPassword } = data;

    if (!name || name.trim().length < 2) {
      throw new Error('Full Name must be at least 2 characters long.');
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new Error('Please provide a valid email address.');
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser: User = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password_hash,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await userRepository.create(newUser);

    const token = this.generateToken(newUser);
    const { password_hash: _, ...safeUser } = newUser;

    return { user: safeUser, token };
  }

  async login(email: string, password: string): Promise<{ user: Omit<User, 'password_hash'>; token: string }> {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password.');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new Error('Invalid email or password.');
    }

    const token = this.generateToken(user);
    const { password_hash: _, ...safeUser } = user;

    return { user: safeUser, token };
  }

  async googleAuth(data: { email: string; name: string; uid?: string }): Promise<{ user: Omit<User, 'password_hash'>; token: string }> {
    const normalizedEmail = data.email.trim().toLowerCase();
    let user = await userRepository.findByEmail(normalizedEmail);

    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const dummyHash = await bcrypt.hash(`google-oauth-${Date.now()}`, salt);

      user = {
        id: data.uid || `usr-goog-${Date.now()}`,
        name: data.name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        password_hash: dummyHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await userRepository.create(user);
    }

    const token = this.generateToken(user);
    const { password_hash: _, ...safeUser } = user;

    return { user: safeUser, token };
  }

  async updateProfile(userId: string, name: string, email: string): Promise<Omit<User, 'password_hash'>> {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error('User not found.');

    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const emailExists = await userRepository.findByEmail(email);
      if (emailExists && emailExists.id !== userId) {
        throw new Error('Email is already in use by another account.');
      }
    }

    const updated = await userRepository.update(userId, {
      name: name ? name.trim() : user.name,
      email: email ? email.trim().toLowerCase() : user.email,
    });

    if (!updated) throw new Error('Failed to update user profile.');
    const { password_hash: _, ...safeUser } = updated;
    return safeUser;
  }

  async changePassword(userId: string, currentPass: string, newPass: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error('User not found.');

    const isMatch = await bcrypt.compare(currentPass, user.password_hash);
    if (!isMatch) {
      throw new Error('Current password is incorrect.');
    }

    if (newPass.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPass, salt);
    await userRepository.update(userId, { password_hash });
  }
}

export const authService = new AuthService();
