import { createContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { auth, provider } from '../services/firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import api from '../api';

/* eslint-disable react-refresh/only-export-components */
export const AuthContext = createContext();

function emitAuthChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('idh-auth-changed'));
}

export default function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const currentPath = window.location.pathname;
    const isAuthPage = currentPath === '/register';

    if (isAuthPage) {
      localStorage.removeItem('user');
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const storedUser = localStorage.getItem('user');
      if (currentUser) {
        const userData = {
          id: currentUser.uid,
          email: currentUser.email,
          name: currentUser.displayName,
          picture: currentUser.photoURL,
          createdAt: currentUser.metadata?.creationTime || null,
          lastLogin: currentUser.metadata?.lastSignInTime || new Date().toISOString(),
        };
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        emitAuthChanged();
        setError(null);
      } else if (storedUser) {
        // If we have a user stored from backend JWT login, keep it and avoid clearing
        setUser(JSON.parse(storedUser));
        emitAuthChanged();
      } else {
        localStorage.removeItem('user');
        setUser(null);
        emitAuthChanged();
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const googleLogin = async () => {
    try {
      setError(null);
      await signInWithPopup(auth, provider);
      // Navigate to dashboard after successful login
      setTimeout(() => {
        navigate('/dashboard');
      }, 500);
    } catch (error) {
      console.error('Google login error:', error);
      let message = 'Google login failed. Please try again.';
      if (error.code === 'auth/popup-closed-by-user') {
        message = 'Login cancelled.';
      } else if (error.code === 'auth/popup-blocked') {
        message = 'Popup blocked. Please allow popups for this site.';
      }
      setError(message);
      setLoading(false);
      throw error;
    }
  };

  const loginWithEmail = async (email, password) => {
    setLoading(true);
    try {
      setError(null);
      const response = await api.post('/auth/login', { email, password });
      const token = response.data.access_token;
      // Decode token
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userData = {
        id: payload.user_id,
        email: payload.email,
        name: payload.username,
        token: token,
        lastLogin: new Date().toISOString(),
      };
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      emitAuthChanged();
    } catch (error) {
      let message = 'Login failed. Please try again.';
      if (error.response && error.response.data && error.response.data.detail) {
        message = error.response.data.detail;
      }
      setError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (email, password) => {
    setLoading(true);
    try {
      setError(null);
      const response = await api.post('/auth/register', { email, password });
      const token = response.data.access_token;
      // Decode token
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userData = {
        id: payload.user_id,
        email: payload.email,
        name: payload.username || email.split('@')[0],
        token: token,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      emitAuthChanged();
    } catch (error) {
      let message = 'Registration failed. Please try again.';
      if (error.response && error.response.data && error.response.data.detail) {
        message = error.response.data.detail;
      }
      setError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendOTP = async (email, username) => {
    setLoading(true);
    try {
      setError(null);
      const response = await api.post('/auth/send-otp', { email, username });
      return response.data;  // Return OTP/debug info for testing
    } catch (error) {
      let message = 'Failed to send OTP. Please try again.';
      if (error.response && error.response.data) {
        // Prefer explicit backend detail/debug messages when available
        if (error.response.data.detail) {
          message = error.response.data.detail;
        } else if (error.response.data.debug_message) {
          message = error.response.data.debug_message;
        } else if (typeof error.response.data === 'string') {
          message = error.response.data;
        }
      }
      setError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (email, otp, password) => {
    setLoading(true);
    try {
      setError(null);
      await api.post('/auth/verify-otp', { email, otp, password });
      setError(`✓ Registration Successful! Account created for ${email}. Please sign in.`);
    } catch (error) {
      let message = 'Verification failed. Please try again.';
      if (error.response && error.response.data && error.response.data.detail) {
        message = error.response.data.detail;
      }
      setError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }

    localStorage.removeItem('user');
    setUser(null);
    emitAuthChanged();
    navigate('/');
  };

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      googleLogin, 
      loginWithEmail,
      registerWithEmail,
      sendOTP,
      verifyOTP,
      logout, 
      loading, 
      error,
      clearError
    }}>
      {children}
    </AuthContext.Provider>
  );
}
