import { getSupabase } from '../sync/supabase';
import { User, Session, AuthError } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
}

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface ProfileUpdateData {
  fullName?: string;
  avatarUrl?: string;
}

export class AuthService {
  private supabase = getSupabase();

  async signUp(data: SignUpData): Promise<{ user: User | null; error: AuthError | null }> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    const { data: authData, error } = await this.supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
        },
      },
    });

    return { user: authData.user, error };
  }

  async signIn(data: SignInData): Promise<{ user: User | null; error: AuthError | null }> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    const { data: authData, error } = await this.supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    return { user: authData.user, error };
  }

  async signOut(): Promise<{ error: AuthError | null }> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    const { error } = await this.supabase.auth.signOut();
    return { error };
  }

  async resetPassword(email: string): Promise<{ error: AuthError | null }> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    const { error } = await this.supabase.auth.resetPasswordForEmail(email);
    return { error };
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.supabase) return null;

    const { data: { user } } = await this.supabase.auth.getUser();
    return user;
  }

  async getCurrentSession(): Promise<Session | null> {
    if (!this.supabase) return null;

    const { data: { session } } = await this.supabase.auth.getSession();
    return session;
  }

  async getUserProfile(userId: string): Promise<AuthUser | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .eq('id', userId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
    };
  }

  async updateProfile(userId: string, updates: ProfileUpdateData): Promise<{ error: any }> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    const { error } = await this.supabase
      .from('profiles')
      .update({
        full_name: updates.fullName,
        avatar_url: updates.avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    return { error };
  }

  async createHousehold(name: string): Promise<{ householdId: string; inviteCode: string; error: any }> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await this.supabase.rpc('create_household', { household_name: name });
    
    if (error) {
      return { householdId: '', inviteCode: '', error };
    }

    // Parse the result (invite code)
    return { householdId: '', inviteCode: data, error: null };
  }

  async joinHousehold(inviteCode: string): Promise<{ householdId: string; error: any }> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await this.supabase.rpc('join_household', { invite_code: inviteCode });
    
    if (error) {
      return { householdId: '', error };
    }

    return { householdId: data, error: null };
  }

  async getUserHouseholds(): Promise<Array<{ id: string; name: string; role: string; inviteCode: string }>> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('user_households')
      .select(`
        household_id,
        role,
        households (
          id,
          name,
          invite_code
        )
      `)
      .eq('user_id', (await this.getCurrentUser())?.id);

    if (error || !data) return [];

    return data.map((item: any) => ({
      id: item.household_id,
      name: item.households?.name || 'Unknown',
      role: item.role,
      inviteCode: item.households?.invite_code || '',
    }));
  }

  // Listen to auth state changes
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    if (!this.supabase) return () => {};

    const { data: { subscription } } = this.supabase.auth.onAuthStateChange(callback);
    return () => subscription.unsubscribe();
  }
}

export const authService = new AuthService();