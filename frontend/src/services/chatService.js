import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

const CHATS_COLLECTION = 'chatbot_sessions';

/**
 * Get all chats for a user, ordered by most recent first
 */
export async function getUserChats(userId) {
  try {
    const q = query(
      collection(db, CHATS_COLLECTION),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('[chatService] Error fetching user chats:', error);
    throw error;
  }
}

/**
 * Get a single chat by ID (with permission check)
 */
export async function getChatById(chatId, userId) {
  try {
    const chatRef = doc(db, CHATS_COLLECTION, chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      throw new Error('Chat not found');
    }
    
    const chatData = chatSnap.data();
    
    // Verify ownership
    if (chatData.userId !== userId) {
      throw new Error('Unauthorized: Chat does not belong to user');
    }
    
    return {
      id: chatSnap.id,
      ...chatData,
    };
  } catch (error) {
    console.error('[chatService] Error fetching chat by ID:', error);
    throw error;
  }
}

/**
 * Create a new chat for a user
 */
export async function createChat(userId, userEmail, { title, sector, dataset }) {
  try {
    const now = new Date();
    const chatData = {
      userId,
      userEmail,
      title: title || 'New Chat',
      sector: sector || 'all',
      dataset: dataset || null,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    
    const docRef = await addDoc(collection(db, CHATS_COLLECTION), chatData);
    return {
      id: docRef.id,
      ...chatData,
    };
  } catch (error) {
    console.error('[chatService] Error creating chat:', error);
    throw error;
  }
}

/**
 * Update a chat (title, dataset, or messages)
 */
export async function updateChat(chatId, userId, updates) {
  try {
    const chatRef = doc(db, CHATS_COLLECTION, chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      throw new Error('Chat not found');
    }
    
    // Verify ownership
    if (chatSnap.data().userId !== userId) {
      throw new Error('Unauthorized: Chat does not belong to user');
    }
    
    const updatedData = {
      ...updates,
      updatedAt: new Date(),
    };
    
    await updateDoc(chatRef, updatedData);
    
    return {
      id: chatId,
      ...chatSnap.data(),
      ...updatedData,
    };
  } catch (error) {
    console.error('[chatService] Error updating chat:', error);
    throw error;
  }
}

/**
 * Add a message to a chat
 */
export async function addMessageToChat(chatId, userId, message) {
  try {
    const chatRef = doc(db, CHATS_COLLECTION, chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      throw new Error('Chat not found');
    }
    
    // Verify ownership
    if (chatSnap.data().userId !== userId) {
      throw new Error('Unauthorized: Chat does not belong to user');
    }
    
    const messages = chatSnap.data().messages || [];
    const newMessages = [...messages, { ...message, timestamp: new Date() }];
    
    // Update the chat with new messages and updatedAt
    await updateDoc(chatRef, {
      messages: newMessages,
      updatedAt: new Date(),
    });
    
    return {
      id: chatId,
      ...chatSnap.data(),
      messages: newMessages,
      updatedAt: new Date(),
    };
  } catch (error) {
    console.error('[chatService] Error adding message to chat:', error);
    throw error;
  }
}

/**
 * Delete a chat
 */
export async function deleteChat(chatId, userId) {
  try {
    const chatRef = doc(db, CHATS_COLLECTION, chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      throw new Error('Chat not found');
    }
    
    // Verify ownership
    if (chatSnap.data().userId !== userId) {
      throw new Error('Unauthorized: Chat does not belong to user');
    }
    
    await deleteDoc(chatRef);
    return true;
  } catch (error) {
    console.error('[chatService] Error deleting chat:', error);
    throw error;
  }
}

/**
 * Update chat title
 */
export async function updateChatTitle(chatId, userId, title) {
  return updateChat(chatId, userId, { title });
}

/**
 * Update chat dataset
 */
export async function updateChatDataset(chatId, userId, dataset) {
  return updateChat(chatId, userId, { dataset });
}

/**
 * Sync chats from localStorage to Firebase (one-time migration)
 */
export async function syncLocalStorageChatsToFirebase(userId, userEmail) {
  try {
    if (typeof window === 'undefined') return [];
    
    // Read from localStorage
    let localChats = [];
    try {
      const rawChats = window.localStorage.getItem('chatbot_sessions');
      localChats = JSON.parse(rawChats || '[]');
    } catch (_error) {
      // Ignore parse errors
      return [];
    }
    
    // Filter and migrate valid chats
    const migratedChats = [];
    const batch = writeBatch(db);
    
    for (const chat of localChats) {
      if (!chat.id) continue;
      
      const chatRef = doc(collection(db, CHATS_COLLECTION));
      batch.set(chatRef, {
        userId,
        userEmail,
        title: chat.title || 'Migrated Chat',
        sector: chat.sector || 'all',
        dataset: chat.dataset || null,
        messages: (chat.messages || []).map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          restricted: msg.restricted,
          matches: msg.matches,
          insights: msg.insights,
          result: msg.result,
        })),
        createdAt: new Date(),
        updatedAt: new Date(),
        migratedFrom: 'localStorage',
      });
      migratedChats.push(chat);
    }
    
    if (migratedChats.length > 0) {
      await batch.commit();
      // Clear localStorage after successful migration
      window.localStorage.removeItem('chatbot_sessions');
      window.localStorage.removeItem('chatbot_active_id');
    }
    
    return migratedChats;
  } catch (error) {
    console.error('[chatService] Error syncing localStorage to Firebase:', error);
    // Return empty array, don't throw - let UI handle it
    return [];
  }
}
