import { db } from '../database/db.js';
import { User } from '../models/index.js';

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    const user = db.users.find((u) => u.id === id);
    return user || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === normalized);
    return user || null;
  }

  async create(user: User): Promise<User> {
    db.users.push(user);
    db.save();
    return user;
  }

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    const index = db.users.findIndex((u) => u.id === id);
    if (index === -1) return null;

    db.users[index] = {
      ...db.users[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    db.save();
    return db.users[index];
  }
}

export const userRepository = new UserRepository();
